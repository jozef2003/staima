-- Drop existing open policies
DROP POLICY IF EXISTS "Allow all access" ON clients;
DROP POLICY IF EXISTS "Allow all access" ON bots;
DROP POLICY IF EXISTS "Allow all access" ON workflows;
DROP POLICY IF EXISTS "Allow all access" ON deployment_log;
DROP POLICY IF EXISTS "Allow all access" ON invoices;
DROP POLICY IF EXISTS "Allow all access" ON servers;

-- Helper: is the current user admin?
-- (service_role always bypasses RLS)

-- CLIENTS
CREATE POLICY "admin_all" ON clients FOR ALL
  USING (auth.jwt() ->> 'email' = 'jozef@staima.ai')
  WITH CHECK (auth.jwt() ->> 'email' = 'jozef@staima.ai');

CREATE POLICY "client_own" ON clients FOR SELECT
  USING (auth.uid() = auth_user_id);

-- BOTS
CREATE POLICY "admin_all" ON bots FOR ALL
  USING (auth.jwt() ->> 'email' = 'jozef@staima.ai')
  WITH CHECK (auth.jwt() ->> 'email' = 'jozef@staima.ai');

CREATE POLICY "client_own" ON bots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = bots.client_id
        AND clients.auth_user_id = auth.uid()
    )
  );

-- WORKFLOWS
CREATE POLICY "admin_all" ON workflows FOR ALL
  USING (auth.jwt() ->> 'email' = 'jozef@staima.ai')
  WITH CHECK (auth.jwt() ->> 'email' = 'jozef@staima.ai');

CREATE POLICY "client_own" ON workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = workflows.client_id
        AND clients.auth_user_id = auth.uid()
    )
  );

-- DEPLOYMENT_LOG
CREATE POLICY "admin_all" ON deployment_log FOR ALL
  USING (auth.jwt() ->> 'email' = 'jozef@staima.ai')
  WITH CHECK (auth.jwt() ->> 'email' = 'jozef@staima.ai');

CREATE POLICY "client_own" ON deployment_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = deployment_log.client_id
        AND clients.auth_user_id = auth.uid()
    )
  );

-- INVOICES
CREATE POLICY "admin_all" ON invoices FOR ALL
  USING (auth.jwt() ->> 'email' = 'jozef@staima.ai')
  WITH CHECK (auth.jwt() ->> 'email' = 'jozef@staima.ai');

CREATE POLICY "client_own" ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = invoices.client_id
        AND clients.auth_user_id = auth.uid()
    )
  );

-- SERVERS
CREATE POLICY "admin_all" ON servers FOR ALL
  USING (auth.jwt() ->> 'email' = 'jozef@staima.ai')
  WITH CHECK (auth.jwt() ->> 'email' = 'jozef@staima.ai');

CREATE POLICY "client_own" ON servers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = servers.client_id
        AND clients.auth_user_id = auth.uid()
    )
  );
