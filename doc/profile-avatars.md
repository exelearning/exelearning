# Profile pictures

## How eXeLearning renders avatars
- eXeLearning uses [Gravatar](https://gravatar.com/) to display user profile pictures.
- The application requests a 96x96 image and falls back to a generated avatar when no image is configured.
- Regular accounts default to Gravatar's `initials` style so the user's initials are shown automatically.
- Guest accounts that use the `@guest.local` domain default to Gravatar's `retro` icon.

## Configure your own image
1. Visit [https://gravatar.com/](https://gravatar.com/) and sign in with your email associated with your eXeLearning account.
3. Upload your preferred profile picture and assign it to that email. Gravatar may ask you to crop or rate the image.
4. Confirm the changes. After a short delay, reload eXeLearning—the new avatar will appear automatically.

## Tips
- Each email address can have its own image. If you change the email associated with your eXeLearning account, update the matching Gravatar entry.
- If you prefer to hide your photo, you can pick any of Gravatar's built-in defaults such as `identicon`, `monsterid`, `retro`, or `robohash`.
- Leaving Gravatar without an image keeps the generated default (`initials` for regular users or `retro` for guests) in eXeLearning.
