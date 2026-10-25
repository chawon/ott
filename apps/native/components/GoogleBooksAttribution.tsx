import { Image, Linking, Pressable, Text } from 'react-native';
import { useNativePreferences } from '../lib/nativePreferences';

export function GoogleBooksAttribution({ book, logo = true }: {
  book?: { provider?: string; providerId?: string; sourceUrl?: string | null };
  logo?: boolean;
}) {
  const { colors } = useNativePreferences();
  let url = book ? null : 'https://books.google.com/';
  if (book?.sourceUrl) {
    try {
      const source = new URL(book.sourceUrl);
      if (source.protocol === 'https:' && source.hostname === 'books.google.com' && !source.username && !source.password) url = source.href;
    } catch { /* Invalid sources do not become external links. */ }
  }
  if (!url && book?.provider === 'GOOGLE_BOOKS' && book.providerId) {
    url = `https://books.google.com/books?id=${encodeURIComponent(book.providerId)}`;
  }
  if (!url) return null;
  const target = url;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel="Google Books"
      onPress={(event) => { event.stopPropagation(); void Linking.openURL(target).catch(() => {}); }}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {logo ? <Image source={require('../assets/google-books-powered-by.png')} style={{ width: 62, height: 30 }} accessibilityLabel="Powered by Google" /> : null}
      <Text style={{ color: colors.link, textDecorationLine: 'underline' }}>Google Books</Text>
    </Pressable>
  );
}
