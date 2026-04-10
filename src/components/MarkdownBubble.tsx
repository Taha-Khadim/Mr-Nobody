import Markdown from 'react-native-markdown-display';
import { Platform, useWindowDimensions } from 'react-native';

const palette = {
  text: '#e4e4e7',
  heading: '#fafafa',
  muted: '#a1a1aa',
  codeBg: '#27272a',
  border: '#3f3f46',
  link: '#a5b4fc',
};

export function MarkdownBubble({ children }: { children: string }) {
  const { width } = useWindowDimensions();
  const maxW = Math.min(width * 0.92 - 24, 600);

  return (
    <Markdown
      style={{
        body: { color: palette.text, fontSize: 16, lineHeight: 24, maxWidth: maxW },
        heading1: {
          color: palette.heading,
          fontSize: 22,
          fontWeight: '700',
          marginTop: 10,
          marginBottom: 6,
        },
        heading2: {
          color: palette.heading,
          fontSize: 19,
          fontWeight: '700',
          marginTop: 10,
          marginBottom: 4,
        },
        heading3: {
          color: palette.heading,
          fontSize: 17,
          fontWeight: '700',
          marginTop: 8,
        },
        paragraph: { marginTop: 6, marginBottom: 6 },
        strong: { fontWeight: '700', color: palette.heading },
        em: { fontStyle: 'italic', color: palette.text },
        bullet_list: { marginVertical: 4 },
        ordered_list: { marginVertical: 4 },
        list_item: { marginVertical: 2 },
        link: { color: palette.link, textDecorationLine: 'underline' },
        blockquote: {
          borderLeftWidth: 3,
          borderLeftColor: palette.border,
          paddingLeft: 12,
          marginVertical: 8,
          color: palette.muted,
        },
        code_inline: {
          backgroundColor: palette.codeBg,
          color: '#fbbf24',
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 6,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 14,
        },
        fence: {
          backgroundColor: palette.codeBg,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 10,
          padding: 12,
          marginVertical: 8,
        },
        code_block: {
          color: palette.text,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 13,
          lineHeight: 20,
        },
        hr: { backgroundColor: palette.border, marginVertical: 12, height: 1 },
      }}
    >
      {children}
    </Markdown>
  );
}

