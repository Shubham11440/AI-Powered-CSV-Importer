import { Request, Response } from 'express';
import Papa from 'papaparse';
import { z } from 'zod';
import { processAllRecords } from '../services/aiService';
import { ImportResponse } from '../types';

const importPayloadSchema = z.object({
  records: z.array(z.record(z.string(), z.any())).min(1, 'No valid records provided for mapping.'),
  batchSize: z.number().int().min(1).max(100).optional(),
  apiKey: z.string().optional(),
});

/**
 * Handle CSV import requests
 */
export async function handleImport(req: Request, res: Response) {
  try {
    let rawRecords: Record<string, any>[] = [];

    // 1. Check if direct JSON array of records was passed
    if (req.body && Array.isArray(req.body.records)) {
      rawRecords = req.body.records;
    } 
    // 2. Check if a CSV file was uploaded via Multer
    else if (req.file) {
      const csvData = req.file.buffer.toString('utf8');
      
      const parseResult = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      if (parseResult.errors && parseResult.errors.length > 0) {
        console.warn('PapaParse parsing warnings:', parseResult.errors);
      }

      rawRecords = parseResult.data as Record<string, any>[];
    } 
    // 3. Neither file nor JSON payload was provided
    else {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Please upload a CSV file or provide JSON records in the "records" body parameter.',
      });
    }

    if (rawRecords.length === 0) {
      return res.status(200).json({
        success: true,
        imported: [],
        skipped: [],
        stats: {
          total: 0,
          imported: 0,
          skipped: 0,
        },
      } as ImportResponse);
    }

    // Validate request schema using Zod
    const validationResult = importPayloadSchema.safeParse({
      records: rawRecords,
      batchSize: req.body.batchSize ? parseInt(req.body.batchSize, 10) : undefined,
      apiKey: req.body.apiKey || undefined
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + validationResult.error.issues.map((e: any) => e.message).join(', '),
        errors: validationResult.error.issues
      });
    }

    // Extract API key if supplied by the client
    let clientApiKey = (req.headers['x-gemini-key'] || req.body.apiKey) as string | undefined;
    const authHeader = req.headers['authorization'];
    if (!clientApiKey && authHeader) {
      if (typeof authHeader === 'string') {
        clientApiKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      }
    }

    // Optional batchSize override
    const batchSize = validationResult.data.batchSize || 25;

    // Process the records through AI
    const result = await processAllRecords(rawRecords, batchSize, clientApiKey);

    const responsePayload: ImportResponse = {
      success: true,
      imported: result.imported,
      skipped: result.skipped,
      stats: {
        total: rawRecords.length,
        imported: result.imported.length,
        skipped: result.skipped.length,
      },
    };

    return res.status(200).json(responsePayload);
  } catch (error: any) {
    console.error('Import controller error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An internal error occurred during lead processing.',
    });
  }
}
