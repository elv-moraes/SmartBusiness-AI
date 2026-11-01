BEGIN;

CREATE TYPE "StockMovementType" AS ENUM ('ENTRY', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOSS', 'RETURN');
CREATE UNIQUE INDEX "products_company_id_id_key" ON "products"("company_id", "id");

CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previous_quantity" INTEGER NOT NULL,
    "new_quantity" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_movements_quantity_check" CHECK (quantity > 0),
    CONSTRAINT "stock_movements_previous_quantity_check" CHECK (previous_quantity >= 0),
    CONSTRAINT "stock_movements_new_quantity_check" CHECK (new_quantity >= 0),
    CONSTRAINT "stock_movements_balance_check" CHECK (
      (type IN ('ENTRY', 'ADJUSTMENT_IN', 'RETURN') AND new_quantity::bigint = previous_quantity::bigint + quantity::bigint)
      OR (type IN ('ADJUSTMENT_OUT', 'LOSS') AND new_quantity::bigint = previous_quantity::bigint - quantity::bigint)
    ),
    CONSTRAINT "stock_movements_key_check" CHECK (length(btrim(idempotency_key)) BETWEEN 1 AND 128 AND idempotency_key = btrim(idempotency_key)),
    CONSTRAINT "stock_movements_note_check" CHECK (note IS NULL OR (length(btrim(note)) BETWEEN 1 AND 500 AND note = btrim(note))),
    CONSTRAINT "stock_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "stock_movements_company_id_product_id_fkey" FOREIGN KEY ("company_id", "product_id") REFERENCES "products"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "stock_movements_company_id_idempotency_key_key" ON "stock_movements"("company_id", "idempotency_key");
CREATE INDEX "stock_movements_company_id_created_at_id_idx" ON "stock_movements"("company_id", "created_at", "id");
CREATE INDEX "stock_movements_company_id_product_id_created_at_id_idx" ON "stock_movements"("company_id", "product_id", "created_at", "id");

-- Default privileges grant DML on new tables. Keep this ledger inaccessible
-- until the next migration installs RLS and restores only SELECT/INSERT.
REVOKE ALL PRIVILEGES ON public.stock_movements FROM smartbusiness_app;

COMMIT;
