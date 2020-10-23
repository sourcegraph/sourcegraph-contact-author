# Contact Author (Sourcegraph extension)

Sourcegraph extension that lets you contact the author of a particular line of code (the last author who modified of that line) by email.

![image](https://user-images.githubusercontent.com/602886/96913896-41efe480-1472-11eb-8c97-4fc075b2afb0.png)

## How it works:

When you select a line while browsing a source file, the extension appends a "Contact author" link next to the line.

The link is a `mailto:` link which will automatically open your default email client, and will pre-fill the recipient, subject and body of the email with the file name and the quoted line of code.
