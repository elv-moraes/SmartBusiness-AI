BEGIN;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select ON public.products
    FOR SELECT TO smartbusiness_app
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);
CREATE POLICY products_insert ON public.products
    FOR INSERT TO smartbusiness_app
    WITH CHECK (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);
CREATE POLICY products_update ON public.products
    FOR UPDATE TO smartbusiness_app
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid)
    WITH CHECK (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);
CREATE POLICY products_delete ON public.products
    FOR DELETE TO smartbusiness_app
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO smartbusiness_app;

COMMIT;
