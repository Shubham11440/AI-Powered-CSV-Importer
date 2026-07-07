import { GoogleGenerativeAI } from '@google/generative-ai';
import { CRMRecord, SkippedRecord } from '../types';

// Initialize Gemini client if API key is provided
const getModel = (customApiKey?: string) => {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing. Please configure it on the server or provide it in the request headers.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  return genAI.getGenerativeModel({ model: modelName });
};

interface AIResponseItem {
  skipped: boolean;
  skip_reason?: string;
  mapped: Partial<CRMRecord> | null;
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    console.warn(`AI request failed. Retrying in ${delay}ms... (Retries left: ${retries})`, error);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
}

/**
 * Process a batch of raw records through Gemini
 */
async function processBatch(
  batch: Record<string, any>[],
  apiKey?: string
): Promise<{ imported: CRMRecord[]; skipped: SkippedRecord[] }> {
  const model = getModel(apiKey);
  const currentDate = new Date().toISOString();

  const systemPrompt = `
You are an expert AI CRM Lead Importer. Your task is to analyze a batch of raw lead records (JSON format) uploaded from an arbitrary CSV export and map them to the GrowEasy CRM schema.

GrowEasy CRM Schema:
- created_at: Lead creation date/time. Convert to ISO 8601 or a standard string format that Javascript's "new Date(created_at)" can parse. If not found or invalid, default to "${currentDate}".
- name: Full name. If separate first/last name columns are present, merge them (e.g. "John" + "Doe" -> "John Doe").
- email: Primary email. Clean and validate format. If multiple emails are listed, take the first one here, and append the others to "crm_note".
- country_code: Country phone code (e.g. "+91", "+1").
- mobile_without_country_code: Mobile number without the country code prefix. Clean it of dashes, spaces, and brackets. If multiple mobile numbers exist, take the first one here and append the others to "crm_note".
- company: Company name.
- city: City name.
- state: State/Region.
- country: Country name.
- lead_owner: Lead owner or assignee.
- crm_status: MUST map to one of these exact enums: "GOOD_LEAD_FOLLOW_UP" | "DID_NOT_CONNECT" | "BAD_LEAD" | "SALE_DONE". If unsure or cannot confidently match, leave blank.
  Mapping guidance:
  - "Follow up", "Hot", "Interested", "reschedule", "warm" -> "GOOD_LEAD_FOLLOW_UP"
  - "No answer", "Unreachable", "Busy", "did not connect" -> "DID_NOT_CONNECT"
  - "Junk", "Not interested", "bad number", "spam" -> "BAD_LEAD"
  - "Closed", "Converted", "Sold", "success" -> "SALE_DONE"
- crm_note: General notes, remarks, follow-up comments, AND overflow fields (like extra emails, extra mobile numbers, or other columns that do not fit in standard CRM fields).
- data_source: MUST map to one of these exact enums: "leads_on_demand" | "meridian_tower" | "eden_park" | "varah_swamy" | "sarjapur_plots". If none fit confidently, leave blank ("").
- possession_time: Property possession time/timeline.
- description: Additional details/description.
- confidence_level: MUST map to one of these exact enums: "High" | "Medium" | "Low". Based on how clean and clear the column mapping was (e.g., standard fields = "High", ambiguous columns or guesswork = "Medium" or "Low").

Strict Rules:
1. If a record has NEITHER email nor a mobile number, it must be skipped. Set "skipped": true and provide "skip_reason": "Missing contact details".
2. If multiple emails or mobile numbers exist, use the first and append the rest to "crm_note".
3. Return the response as a valid JSON array of objects, where each object corresponds to a record in the input.

Input JSON data:
${JSON.stringify(batch, null, 2)}

Response JSON Schema:
Provide your output as a JSON array of objects, matching this structure:
[
  {
    "skipped": false,
    "mapped": {
      "created_at": "YYYY-MM-DD HH:MM:SS",
      "name": "...",
      "email": "...",
      "country_code": "...",
      "mobile_without_country_code": "...",
      "company": "...",
      "city": "...",
      "state": "...",
      "country": "...",
      "lead_owner": "...",
      "crm_status": "GOOD_LEAD_FOLLOW_UP",
      "crm_note": "...",
      "data_source": "leads_on_demand",
      "possession_time": "...",
      "description": "...",
      "confidence_level": "High"
    }
  },
  {
    "skipped": true,
    "skip_reason": "Reason for skipping",
    "mapped": null
  }
]
`;

  const makeRequest = async () => {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.response.text();
    if (!responseText) {
      throw new Error('Received empty response from Gemini API.');
    }

    try {
      const parsed: AIResponseItem[] = JSON.parse(responseText);
      return parsed;
    } catch (e: any) {
      throw new Error(`Failed to parse Gemini response as JSON: ${e.message}. Raw text: ${responseText}`);
    }
  };

  const aiResults = await retryWithBackoff(makeRequest, 3, 1500);

  const imported: CRMRecord[] = [];
  const skipped: SkippedRecord[] = [];

  // Match AI results back to original batch
  batch.forEach((originalRecord, index) => {
    const aiItem = aiResults[index];
    if (!aiItem || aiItem.skipped || !aiItem.mapped) {
      skipped.push({
        record: originalRecord,
        reason: aiItem?.skip_reason || 'AI classified as skipped or parsing error occurred.',
      });
      return;
    }

    const mapped = aiItem.mapped;

    // Double check email and phone validation in code for ultimate safety
    const email = (mapped.email || '').trim();
    const mobile = (mapped.mobile_without_country_code || '').trim();

    if (!email && !mobile) {
      skipped.push({
        record: originalRecord,
        reason: 'Skipped: Record contains neither email nor mobile number.',
      });
      return;
    }

    // Strict enum validations
    const allowedStatuses = ['GOOD_LEAD_FOLLOW_UP', 'DID_NOT_CONNECT', 'BAD_LEAD', 'SALE_DONE', ''];
    let crmStatus = (mapped.crm_status || '') as CRMRecord['crm_status'];
    if (!allowedStatuses.includes(crmStatus)) {
      crmStatus = '';
    }

    const allowedDataSources = ['leads_on_demand', 'meridian_tower', 'eden_park', 'varah_swamy', 'sarjapur_plots', ''];
    let dataSource = (mapped.data_source || '') as CRMRecord['data_source'];
    if (!allowedDataSources.includes(dataSource)) {
      dataSource = '';
    }

    // Verify date parseability
    let createdAt = mapped.created_at || currentDate;
    try {
      const parsedDate = new Date(createdAt);
      if (isNaN(parsedDate.getTime())) {
        createdAt = currentDate;
      }
    } catch {
      createdAt = currentDate;
    }

    const allowedConfidences = ['High', 'Medium', 'Low'];
    let confidenceLevel = (mapped.confidence_level || 'High') as CRMRecord['confidence_level'];
    if (!allowedConfidences.includes(confidenceLevel)) {
      confidenceLevel = 'High';
    }

    imported.push({
      created_at: createdAt,
      name: mapped.name || '',
      email: email,
      country_code: mapped.country_code || '',
      mobile_without_country_code: mobile,
      company: mapped.company || '',
      city: mapped.city || '',
      state: mapped.state || '',
      country: mapped.country || '',
      lead_owner: mapped.lead_owner || '',
      crm_status: crmStatus,
      crm_note: mapped.crm_note || '',
      data_source: dataSource,
      possession_time: mapped.possession_time || '',
      description: mapped.description || '',
      confidence_level: confidenceLevel,
    });
  });

  return { imported, skipped };
}

/**
 * Process all records in batches
 */
export async function processAllRecords(
  records: Record<string, any>[],
  batchSize = 25,
  apiKey?: string,
  onProgress?: (progress: number) => void
): Promise<{ imported: CRMRecord[]; skipped: SkippedRecord[] }> {
  const imported: CRMRecord[] = [];
  const skipped: SkippedRecord[] = [];

  const totalRecords = records.length;
  if (totalRecords === 0) {
    return { imported, skipped };
  }

  // Filter out completely empty records first
  const cleanRecords = records.filter((rec) => {
    const values = Object.values(rec).map((v) => String(v || '').trim());
    return values.some((v) => v !== '');
  });

  const totalClean = cleanRecords.length;
  const totalSkippedEmpty = totalRecords - totalClean;

  for (let i = 0; i < totalSkippedEmpty; i++) {
    skipped.push({
      record: {},
      reason: 'Empty row in CSV',
    });
  }

  // Process in batches
  for (let i = 0; i < totalClean; i += batchSize) {
    const batch = cleanRecords.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(totalClean / batchSize)}`);
    
    try {
      const result = await processBatch(batch, apiKey);
      imported.push(...result.imported);
      skipped.push(...result.skipped);
    } catch (error: any) {
      console.error(`Error processing batch starting at index ${i}:`, error);
      // Mark whole batch as skipped due to failure
      batch.forEach((record) => {
        skipped.push({
          record,
          reason: `AI service error: ${error.message || 'Unknown processing error'}`,
        });
      });
    }

    if (onProgress) {
      const progress = Math.min(100, Math.round(((i + batch.length) / totalClean) * 100));
      onProgress(progress);
    }
  }

  return { imported, skipped };
}
