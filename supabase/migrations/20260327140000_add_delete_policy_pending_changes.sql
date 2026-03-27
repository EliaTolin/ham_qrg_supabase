-- Add missing DELETE policy for sync_pending_changes
CREATE POLICY "Admin can delete pending changes"
  ON public.sync_pending_changes FOR DELETE TO authenticated
  USING (public.authorize('sync.review'::public.app_permission));
