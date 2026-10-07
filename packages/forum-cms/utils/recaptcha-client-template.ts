// Shared source for Keystone's generated login and password-reset pages.
export const recaptchaClientTemplate = `
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      render: (element: HTMLElement, options: Record<string, unknown>) => number;
      reset: (widgetId: number) => void;
    };
  }
}

function useRecaptchaChallenge() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(!RECAPTCHA_ENABLED);
  const [recaptchaError, setRecaptchaError] = useState('');

  useEffect(() => {
    if (!RECAPTCHA_ENABLED) return;
    if (!RECAPTCHA_SITE_KEY) {
      setRecaptchaError('人機驗證尚未設定，請聯繫管理員');
      return;
    }
    let active = true;
    const fail = () => {
      if (!active) return;
      setToken(null);
      setRecaptchaError('人機驗證載入失敗，請重新整理頁面後再試');
    };
    const render = () => {
      window.grecaptcha.ready(() => {
        if (!active || !containerRef.current || widgetId.current !== null) return;
        try {
          widgetId.current = window.grecaptcha.render(containerRef.current, {
            sitekey: RECAPTCHA_SITE_KEY,
            callback: (response: string) => { if (active) { setToken(response); setRecaptchaError(''); } },
            'expired-callback': () => { if (active) { setToken(null); setRecaptchaError('驗證已過期，請重新勾選人機驗證'); } },
            'error-callback': fail,
          });
          setRecaptchaLoaded(true);
        } catch { fail(); }
      });
    };
    let script = document.getElementById('cms-recaptcha-v2') as HTMLScriptElement | null;
    if (window.grecaptcha) {
      render();
    } else {
      if (!script) {
        script = document.createElement('script');
        script.id = 'cms-recaptcha-v2';
        script.src = 'https://www.google.com/recaptcha/api.js?render=explicit&hl=zh-TW';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
      script.addEventListener('error', fail);
    }
    return () => {
      active = false;
      script?.removeEventListener('load', render);
      script?.removeEventListener('error', fail);
      if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
      widgetId.current = null;
      containerRef.current?.replaceChildren();
    };
  }, []);

  const resetRecaptcha = () => {
    setToken(null);
    if (widgetId.current !== null) window.grecaptcha.reset(widgetId.current);
  };
  return { containerRef, recaptchaLoaded, recaptchaError, recaptchaToken: token, resetRecaptcha };
}
`;
