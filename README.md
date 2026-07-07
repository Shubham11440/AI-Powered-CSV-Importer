# AI-Powered CSV Importer

An AI-powered CSV Importer that allows users to upload CSV leads of arbitrary formats (different columns, layout, and structure) and dynamically maps them to the GrowEasy CRM schema using Gemini LLM.

## Features

- **Drag & Drop Upload / File Picker**: Simple and modern frontend interface.
- **Client-Side CSV Preview**: Parses the CSV locally using `PapaParse` and displays a responsive preview table with vertical & horizontal scrolling and sticky headers.
- **Interactive Configuration Control**: Switch the backend API URL, override the Gemini API Key directly in the UI (stored in `localStorage` for convenience), and slide the batch size.
- **AI-Powered Field Mapping**: Maps headers and cleans values in batches using Gemini to extract standardized fields:
  - `created_at` (Lead creation date, ISO format)
  - `name` (Combines first/last names)
  - `email` (Primary email. Excess emails are appended to CRM notes)
  - `country_code` & `mobile_without_country_code` (Primary phone. Excess phones appended to CRM notes)
  - `company`, `city`, `state`, `country`, `lead_owner`, `possession_time`, `description`
  - `crm_status` (Mapped to strict enums: `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE`)
  - `data_source` (Mapped to strict enums: `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots` or blank)
  - `crm_note` (Remarks and overflow data)
- **Automatic Validation & Filter**: Rows missing both email and mobile numbers are automatically filtered out.
- **Results Dashboard**: View total, imported, and skipped lead counts. Search, filter by status, and filter by source on the successfully imported and skipped records.
- **Robust Error Handling**: Real-time batch-level retry mechanism with exponential backoff on the AI service, logging failure reasons to the skipped records list without crashing imports.

---

## Technical Stack

- **Frontend**: Next.js (App Router, TypeScript, Vanilla CSS design system, Lucide icons, PapaParse)
- **Backend**: Node.js, Express, TypeScript, Multer, `@google/generative-ai` SDK
- **AI Engine**: Gemini AI

---

## Directory Structure

```
├── backend/                # Express backend application
│   ├── src/
│   │   ├── controllers/    # Controller handling route payloads
│   │   ├── routes/         # Multer and Express routes
│   │   ├── services/       # Gemini AI service, prompting, batching & retries
│   │   ├── test.ts         # Testing and validation script
│   │   └── types.ts        # Type-safety interface declarations
│   ├── tsconfig.json       # Backend TypeScript configuration
│   └── package.json        # Backend dependencies & scripts
│
├── frontend/               # Next.js frontend application
│   ├── src/
│   │   └── app/            # Next.js Page Router layout, globals, page
│   ├── tsconfig.json       # Frontend TypeScript configuration
│   └── package.json        # Frontend dependencies & scripts
│
├── sample_csvs/            # Sample formats (Facebook, Google, Real Estate CRM)
├── HLD_and_SPEC.md         # High Level Design Specifications (Git ignored)
└── package.json            # Root workspace script launcher
```

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- NPM or Yarn

### 2. Installation
From the root workspace directory, run:
```bash
npm run install:all
```
This script will install dependencies for the root workspace, backend, and frontend directories.

### 3. Environment Configuration
Create a `.env` file in the `backend` folder (you can copy `backend/.env.example` to `backend/.env`):
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

*Note: If `GEMINI_API_KEY` is not provided in the backend `.env`, you can enter it directly in the frontend UI's **Configure** modal.*

### 4. Running the Application
To run the frontend and backend servers concurrently, execute:
```bash
npm run dev
```
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000

---

## Verification & Testing

### 1. Automated Validation Tests
To run verification tests for CRM validation filters, schema mappings, and live Gemini API compatibility, run:
```bash
npm run test --prefix backend
```

### 2. Manual Testing using Sample CSVs
You can upload the test files located in the `sample_csvs/` folder:
1. `facebook_leads.csv` (Standard header formats with some unmapped columns)
2. `google_ads.csv` (Alternate headers and source fields)
3. `real_estate.csv` (Complex headers with possession times and multiple contact records)
