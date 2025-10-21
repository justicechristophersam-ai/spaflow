import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useIsAdmin() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email ?? null;
      if (!email) {
        if (!cancelled) {
          setUserEmail(null);
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }
      setUserEmail(email);

      const { data, error } = await supabase.rpc('is_admin');
      if (!cancelled) {
        if (error) {
          console.error('is_admin RPC error', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(Boolean(data));
        }
        setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return { loading, isAdmin, userEmail };
}
