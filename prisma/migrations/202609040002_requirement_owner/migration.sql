-- Requirement ownership: link a brief to the account that submitted it.
--
-- Until now `Requirement` was write-only in practice. Rows were persisted with
-- an encrypted phone number and a retention clock, but nothing recorded WHO
-- had submitted them, so no dashboard could ever show a person their own
-- requirements. This adds that link.
--
-- `userId` is NULLABLE on purpose. The public requirement drawer is open to
-- anonymous visitors -- requiring a sign-up before someone can state what they
-- are looking for would simply lose the requirement. An anonymous brief stays
-- a valid lead for the desk; it just never appears on anyone's dashboard.
--
-- ON DELETE SET NULL rather than CASCADE: the row carries a consent record and
-- a retention deadline, and erasing an account must not silently destroy the
-- evidence that consent was given. The brief is anonymised, not deleted.

ALTER TABLE "Requirement" ADD COLUMN "userId" TEXT;

ALTER TABLE "Requirement"
  ADD CONSTRAINT "Requirement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The dashboard read path is always "this person's briefs, newest first".
CREATE INDEX "Requirement_userId_createdAt_idx" ON "Requirement"("userId", "createdAt");
