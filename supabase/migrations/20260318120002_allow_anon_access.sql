-- Allow anonymous access for dashboard (single-user app)
-- Drop restrictive policies
DROP POLICY IF EXISTS "Authenticated users full access" ON clients;
DROP POLICY IF EXISTS "Authenticated users full access" ON workflows;
DROP POLICY IF EXISTS "Authenticated users full access" ON deployment_log;
DROP POLICY IF EXISTS "Authenticated users full access" ON invoices;

-- Create open policies (single-user dashboard, no auth needed)
CREATE POLICY "Allow all access" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON workflows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON deployment_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access" ON invoices FOR ALL USING (true) WITH CHECK (true);
