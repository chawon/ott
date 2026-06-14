import { StaticInfoScreen } from '../components/StaticInfoScreen';
import { staticInfoFor } from '../lib/i18n';
import { useNativePreferences } from '../lib/nativePreferences';

export default function PrivacyScreen() {
  const { locale } = useNativePreferences();
  return <StaticInfoScreen {...staticInfoFor(locale, 'privacy')} />;
}
