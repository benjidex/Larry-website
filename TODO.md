# Supabase Migration Plan

## Steps
- [x] Plan approved
- [x] **Step 1**: Create SQL schema file (`supabase-schema.sql`)
- [x] **Step 2**: Update `package.json` — replace `@supabase/server` with `@supabase/supabase-js` and add `dotenv`
- [x] **Step 3**: Install updated npm dependencies
- [x] **Step 4**: Rewrite `server.js` — integrate Supabase client, replace JSON file storage
- [ ] **Step 5**: Run the SQL schema in Supabase dashboard (user action needed)
- [ ] **Step 6**: Test the booking flow

