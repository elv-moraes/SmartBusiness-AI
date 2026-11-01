BEGIN;

CREATE UNIQUE INDEX "categories_company_id_id_key" ON "categories"("company_id", "id");

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "internal_code" VARCHAR(64),
    "purchase_price" DECIMAL(12,2),
    "sale_price" DECIMAL(12,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "minimum_stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_name_check" CHECK (length(btrim(name)) BETWEEN 2 AND 120),
    CONSTRAINT "products_internal_code_check" CHECK (internal_code IS NULL OR (internal_code = btrim(internal_code) AND length(internal_code) BETWEEN 1 AND 64)),
    CONSTRAINT "products_purchase_price_check" CHECK (purchase_price IS NULL OR (purchase_price >= 0 AND purchase_price <> 'NaN'::numeric)),
    CONSTRAINT "products_sale_price_check" CHECK (sale_price >= 0 AND sale_price <> 'NaN'::numeric),
    CONSTRAINT "products_stock_quantity_check" CHECK (stock_quantity >= 0),
    CONSTRAINT "products_minimum_stock_check" CHECK (minimum_stock >= 0),
    CONSTRAINT "products_version_check" CHECK (version >= 1),
    CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "products_company_id_category_id_fkey" FOREIGN KEY ("company_id", "category_id") REFERENCES "categories"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "products_company_id_internal_code_key" ON "products"("company_id", "internal_code");
CREATE INDEX "products_company_id_category_id_idx" ON "products"("company_id", "category_id");
CREATE INDEX "products_company_id_name_id_idx" ON "products"("company_id", "name", "id");

-- Do not expose a new tenant table between the structural and RLS migrations.
-- The next migration restores only ordinary DML after installing all policies.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.products FROM smartbusiness_app;

COMMIT;
