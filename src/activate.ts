import * as sourcegraph from 'sourcegraph'
import { EMPTY, from, Observable } from 'rxjs'
import { filter, map, switchMap } from 'rxjs/operators'
import { Hunk, queryBlameHunks } from './blame'

const decorationType = sourcegraph.app.createDecorationType()

function observeActiveCodeEditorChanges(): Observable<sourcegraph.CodeEditor> {
    return from(sourcegraph.app.activeWindowChanges).pipe(
        switchMap(activeWindow => activeWindow?.activeViewComponentChanges || EMPTY),
        filter((viewer): viewer is sourcegraph.CodeEditor => !!viewer && viewer.type === 'CodeEditor')
    )
}

function observeCodeEditorSelectionChanges() {
    return observeActiveCodeEditorChanges().pipe(
        switchMap(editor => from(editor.selectionsChanges).pipe(map(selections => ({ editor, selections }))))
    )
}

export function activate(ctx: sourcegraph.ExtensionContext): void {
    ctx.subscriptions.add(
        observeCodeEditorSelectionChanges().subscribe(async ({ selections, editor }) => {
            const blameHunks = await queryBlameHunks(editor.document.uri)
            console.log('blameHunks', blameHunks)
            const selectedLine = selections.length ? selections[0].start.line : null

            if (selectedLine) {
                console.log({ selectedLine })
                const author = getAuthorForLine(selectedLine, blameHunks)
                if (author) {
                    editor.setDecorations(decorationType, [
                        {
                            range: new sourcegraph.Range(selectedLine, 0, selectedLine, 0),
                            after: {
                                color: '#2aa198', // TODO: Pick correct color
                                contentText: `📣 Contact ${author.person.displayName}`,
                                linkURL: `mailto:${author.person.email}`, // TODO: Add the link to the current file and line
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
