import * as sourcegraph from 'sourcegraph'
import { EMPTY, from, Observable } from 'rxjs'
import { filter, map, switchMap } from 'rxjs/operators'
import { Hunk, queryBlameHunks as queryBlameHunkForLine, resolveURI } from './blame'

const decorationType = sourcegraph.app.createDecorationType()

function observeActiveCodeEditorChanges(): Observable<sourcegraph.CodeEditor> {
    return from(sourcegraph.app.activeWindowChanges).pipe(
        switchMap(activeWindow => activeWindow?.activeViewComponentChanges || EMPTY),
        filter((viewer): viewer is sourcegraph.CodeEditor => !!viewer && viewer.type === 'CodeEditor')
    )
}

function observeCodeEditorSelectionChanges(): Observable<{
    editor: sourcegraph.CodeEditor
    selections: sourcegraph.Selection[]
}> {
    return observeActiveCodeEditorChanges().pipe(
        switchMap(editor => from(editor.selectionsChanges).pipe(map(selections => ({ editor, selections }))))
    )
}

function renderDecorationContent(authorPerson: Hunk['author']['person']): string {
    return `📣 Contact author: ${authorPerson.displayName}`
}

function renderMailtoLink(email: string, body: string, subject: string): string {
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function getLineFromText(text: sourcegraph.TextDocument['text'] = '', lineNumber: number): string {
    return text.split('\n')[lineNumber] || ''
}

function getFileName(uri: string): string {
    return resolveURI(uri).path
}

async function displayContactAuthorDecoration(editor: sourcegraph.CodeEditor, selectedLine: number): Promise<void> {
    const blameHunks = await queryBlameHunkForLine(editor.document.uri, selectedLine)
    const author = getAuthorForLine(selectedLine, blameHunks)
    if (author) {
        const fileName = getFileName(editor.document.uri)
        const body = `On line ${selectedLine}:\n\n> ${getLineFromText(editor.document.text, selectedLine)}\n\n`
        const mailtoUrl = renderMailtoLink(author.person.email, body, `About ${fileName}`)
        editor.setDecorations(decorationType, [
            {
                range: new sourcegraph.Range(selectedLine, 0, selectedLine, 0),
                after: {
                    color: '#2aa198', // TODO: Pick correct color
                    contentText: renderDecorationContent(author.person),
                    linkURL: mailtoUrl,
                },
            },
        ])
    }
}

export function activate(context: sourcegraph.ExtensionContext): void {
    context.subscriptions.add(
        observeCodeEditorSelectionChanges().subscribe(({ selections, editor }) => {
            const selectedLine = selections.length > 0 ? selections[0].start.line : null

            if (selectedLine !== null) {
                displayContactAuthorDecoration(editor, selectedLine).catch(console.error)
            }
        })
    )
}

/**
 * Get the author for a particular line, from the array of blame hunks.
 */
function getAuthorForLine(lineNumber: number, blameHunks: Hunk[]): Hunk['author'] | undefined {
    return blameHunks.find(hunk => lineNumber >= hunk.startLine && lineNumber <= hunk.endLine)?.author
}
