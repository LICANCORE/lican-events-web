import useLanguage from '../i18n/useLanguage';
import ConsentManager from './ConsentManager';

export default function SiteConsent() {
  const { language } = useLanguage();
  return <ConsentManager language={language} />;
}
