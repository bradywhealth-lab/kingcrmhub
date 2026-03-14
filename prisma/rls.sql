-- Apply tenant-aware row level security policies to existing tables.
DO $$
DECLARE
    tbl_name TEXT;
    tenant_expr TEXT;
    table_names TEXT[] := ARRAY[
        'AIFeedback', 'Organization', 'User', 'Lead', 'CSVUpload', 'Note', 'Tag', 'LeadTag', 'CustomField',
        'Pipeline', 'PipelineStage', 'PipelineItem', 'Automation', 'AutomationLog', 'Sequence', 'SequenceStep',
        'SequenceEnrollment', 'Activity', 'Campaign', 'ContentQueue', 'SocialAccount', 'ScrapeJob', 'ScrapedContact',
        'Carrier', 'CarrierDocument', 'CarrierDocumentChunk', 'Integration', 'Webhook', 'Template', 'AIModelConfig',
        'AIInsight', 'TeamMember', 'LeadAssignment', 'TeamActivity', 'LeadScoreHistory', 'PredictiveModel', 'Quote',
        'QuoteLineItem', 'QuoteVersion', 'MessageThread', 'Message', 'AuditLog', 'UserSession'
    ];
BEGIN
    FOREACH tbl_name IN ARRAY table_names LOOP
        IF tbl_name = 'Organization' THEN
            tenant_expr := '"id" = nullif(current_setting(''app.current_organization_id'', true), '''')';
        ELSIF tbl_name = 'User' THEN
            tenant_expr := '"organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
                OR EXISTS (
                    SELECT 1
                    FROM public."UserSession" us
                    WHERE us."userId" = "id"
                      AND us."token" = nullif(current_setting(''app.current_session_token'', true), '''')
                )';
        ELSIF tbl_name = 'UserSession' THEN
            tenant_expr := '"token" = nullif(current_setting(''app.current_session_token'', true), '''')';
        ELSIF EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = tbl_name
              AND c.column_name = 'organizationId'
        ) THEN
            tenant_expr := '"organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')';
        ELSIF tbl_name = 'Note' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Lead" l
                WHERE l."id" = "leadId"
                  AND l."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'LeadTag' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Lead" l
                WHERE l."id" = "leadId"
                  AND l."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'PipelineStage' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Pipeline" p
                WHERE p."id" = "pipelineId"
                  AND p."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'PipelineItem' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Pipeline" p
                WHERE p."id" = "pipelineId"
                  AND p."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'AutomationLog' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Automation" a
                WHERE a."id" = "automationId"
                  AND a."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'SequenceStep' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Sequence" s
                WHERE s."id" = "sequenceId"
                  AND s."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'SequenceEnrollment' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Sequence" s
                WHERE s."id" = "sequenceId"
                  AND s."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'LeadScoreHistory' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Lead" l
                WHERE l."id" = "leadId"
                  AND l."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'QuoteLineItem' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Quote" q
                WHERE q."id" = "quoteId"
                  AND q."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'QuoteVersion' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."Quote" q
                WHERE q."id" = "quoteId"
                  AND q."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'Message' THEN
            tenant_expr := 'EXISTS (
                SELECT 1
                FROM public."MessageThread" mt
                WHERE mt."id" = "threadId"
                  AND mt."organizationId" = nullif(current_setting(''app.current_organization_id'', true), '''')
            )';
        ELSIF tbl_name = 'AIFeedback' THEN
            -- AIFeedback has no organization linkage yet; keep default-deny until schema is tenant-aware.
            tenant_expr := 'false';
        ELSE
            tenant_expr := 'false';
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl_name);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl_name);
        EXECUTE format('DROP POLICY IF EXISTS app_tenant_policy ON public.%I', tbl_name);
        EXECUTE format(
            'CREATE POLICY app_tenant_policy ON public.%I FOR ALL USING (%s) WITH CHECK (%s)',
            tbl_name,
            tenant_expr,
            tenant_expr
        );
    END LOOP;
END $$;
