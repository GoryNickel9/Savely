-- Add data_finito field to cbd and thc tables
ALTER TABLE cbd ADD COLUMN data_finito TIMESTAMP WITH TIME ZONE;

ALTER TABLE thc ADD COLUMN data_finito TIMESTAMP WITH TIME ZONE;