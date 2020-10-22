import * as sourcegraph from 'sourcegraph'
import { EMPTY, from, Observable } from 'rxjs'
import { filter, map, switchMap } from 'rxjs/operators'
import { Hunk, queryBlameHunks, resolveURI } from './blame'

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

function renderMailtoLink(email: string, body: string, subject: string) {
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function getLineFromText(text: sourcegraph.TextDocument['text'] = '', lineNumber: number): string {
    return text.split('\n')[lineNumber] || ''
}

function getFileName(uri: string): string {
    return resolveURI(uri).path
}

export function activate(context: sourcegraph.ExtensionContext): void {
    context.subscriptions.add(
        observeCodeEditorSelectionChanges().subscribe(async ({ selections, editor }) => {
            const blameHunks = await queryBlameHunks(editor.document.uri)
            const selectedLine = selections.length > 0 ? selections[0].start.line : null

            if (selectedLine !== null) {
                console.log({ selectedLine })
                const author = getAuthorForLine(selectedLine, blameHunks)
                console.log({ author })
                if (author) {
                    const fileName = getFileName(editor.document.uri)
                    const body = `On line ${selectedLine}:\n\n> ${getLineFromText(
                        editor.document.text,
                        selectedLine
                    )}\n\n`
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
        })
    )
}

function getAuthorForLine(lineNumber: number, blameHunks: Hunk[]): Hunk['author'] | undefined {
    return blameHunks.find(hunk => lineNumber >= hunk.startLine && lineNumber <= hunk.endLine)?.author
}
