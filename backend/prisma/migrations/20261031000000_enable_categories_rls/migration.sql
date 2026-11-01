BEGIN;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_select ON public.categories
    FOR SELECT TO smartbusiness_app
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);

CREATE POLICY categories_insert ON public.categories
    FOR INSERT TO smartbusiness_app
    WITH CHECK (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);

CREATE POLICY categories_update ON public.categories
    FOR UPDATE TO smartbusiness_app
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid)
    WITH CHECK (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);

CREATE POLICY categories_delete ON public.categories
    FOR DELETE TO smartbusiness_app
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);

COMMIT;
