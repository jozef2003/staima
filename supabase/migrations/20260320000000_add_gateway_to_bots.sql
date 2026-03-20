-- Add gateway fields to bots for Dashboard Chat
ALTER TABLE bots ADD COLUMN IF NOT EXISTS gateway_url TEXT;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS gateway_token TEXT;

-- Update Sietch with gateway info
UPDATE bots
SET
  gateway_url = 'https://myty.agency/bots/sietch',
  gateway_token = 'a3f8c21e7b4d9052e6a1f3b8d7c4e912f5a8b3c1d6e9f2a5'
WHERE sandbox_name = 'sietch';

-- Update Nora with gateway info
UPDATE bots
SET
  gateway_url = 'https://myty.agency/bots/nora',
  gateway_token = '6126bd2c1de4ac69c0a9ea076f23e06cdc5be11ce6a95a41'
WHERE sandbox_name = 'nora';
