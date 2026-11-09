import { parseJobText } from '@/lib/jobText';

/** The employer's own text, laid out with headings, paragraphs and lists. Text only: nothing from the posting is rendered as markup. */
export function JobDescription({ text }: { text: string }) {
  const blocks = parseJobText(text);
  return (
    <div className="job-text">
      {blocks.map((b, i) => {
        if (b.type === 'heading') return <h2 key={i}>{b.text}</h2>;
        if (b.type === 'list') {
          return (
            <ul key={i}>
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{b.text}</p>;
      })}
    </div>
  );
}
