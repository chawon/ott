import { StaticInfoScreen } from '../components/StaticInfoScreen';
import { staticInfoFor } from '../lib/i18n';
import { useNativePreferences } from '../lib/nativePreferences';

export default function OfflineScreen() {
  const { locale } = useNativePreferences();
  return <StaticInfoScreen {...staticInfoFor(locale, 'offline')} />;
}
