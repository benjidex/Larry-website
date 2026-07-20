# Supabase Migration Plan

## Steps
- [x] Plan approved
- [x] **Step 1**: Create SQL schema file (`supabase-schema.sql`)
- [x] **Step 2**: Update `package.json` — replace `@supabase/server` with `@supabase/supabase-js` and add `dotenv`
- [x] **Step 3**: Install updated npm dependencies
- [x] **Step 4**: Rewrite `server.js` — integrate Supabase client, replace JSON file storage
- [x] **Step 5**: Add email notification — install `nodemailer`, send email to studio on every booking
- [x] **Step 6**: Server running and tested
- [ ] **Step 7**: Run the SQL schema in Supabase dashboard (user action needed — see below)

