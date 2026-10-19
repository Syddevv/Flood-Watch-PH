-- Keep the old city label for display and preserve rows outside the province for review.
ALTER TABLE "EvacuationCenter" ADD COLUMN "localityCode" TEXT;

UPDATE "EvacuationCenter" AS center
SET "localityCode" = locality.code
FROM (VALUES
  ('angat', '0301401000'), ('balagtas', '0301402000'),
  ('city of baliwag', '0301403000'), ('baliwag', '0301403000'),
  ('bocaue', '0301404000'), ('bulacan', '0301405000'), ('bulakan', '0301405000'),
  ('bustos', '0301406000'), ('calumpit', '0301407000'),
  ('guiguinto', '0301408000'), ('hagonoy', '0301409000'),
  ('city of malolos', '0301410000'), ('malolos', '0301410000'), ('malolos city', '0301410000'),
  ('marilao', '0301411000'),
  ('city of meycauayan', '0301412000'), ('meycauayan', '0301412000'), ('meycauayan city', '0301412000'),
  ('norzagaray', '0301413000'), ('obando', '0301414000'), ('pandi', '0301415000'),
  ('paombong', '0301416000'), ('plaridel', '0301417000'), ('pulilan', '0301418000'),
  ('san ildefonso', '0301419000'),
  ('city of san jose del monte', '0301420000'), ('san jose del monte', '0301420000'), ('san jose del monte city', '0301420000'),
  ('san miguel', '0301421000'), ('san rafael', '0301422000'),
  ('santa maria', '0301423000'), ('doña remedios trinidad', '0301424000')
) AS locality(name, code)
WHERE lower(trim(center."province")) = 'bulacan'
  AND lower(trim(center."city")) = locality.name
  AND center."localityCode" IS NULL;

CREATE INDEX "EvacuationCenter_localityCode_idx" ON "EvacuationCenter"("localityCode");
