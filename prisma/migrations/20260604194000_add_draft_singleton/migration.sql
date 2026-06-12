-- Enforce the product invariant that only one draft can be processed.
CREATE UNIQUE INDEX "Draft_status_key" ON "Draft"("status");
