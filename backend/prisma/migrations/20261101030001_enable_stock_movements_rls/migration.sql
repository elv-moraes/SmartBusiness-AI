BEGIN;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_select ON public.stock_movements
    FOR SELECT TO smartbusiness_app
    USING (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);
CREATE POLICY stock_movements_insert ON public.stock_movements
    FOR INSERT TO smartbusiness_app
    WITH CHECK (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);

GRANT SELECT, INSERT ON public.stock_movements TO smartbusiness_app;

COMMIT;
