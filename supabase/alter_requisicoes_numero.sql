-- Alter column type to text to allow '26/0001' format
ALTER TABLE requisicoes ALTER COLUMN numero TYPE text;

-- Drop default value if it was a serial/sequence (optional, but good practice if we manage ID in app)
ALTER TABLE requisicoes ALTER COLUMN numero DROP DEFAULT;
