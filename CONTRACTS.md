# Contracts

**Spec version:** 4


## Entities

| Entity | Owner | Writers |
| --- | --- | --- |
| users | Authentication and Roles | Authentication and Roles |
| organizations | Projects and External Organization Spaces | Projects and External Organization Spaces |
| invitations | Authentication and Roles | Authentication and Roles |
| projects | Projects and External Organization Spaces | Projects and External Organization Spaces |
| project_members | Projects and External Organization Spaces | Projects and External Organization Spaces |
| folders | File Explorer | File Explorer |
| files | File Explorer | File Explorer |
| file_versions | File Explorer | File Explorer |
| channels | Projects and External Organization Spaces | Projects and External Organization Spaces, General Channels, Active Question Chats |
| question_resolutions | Active Question Chats | Active Question Chats |
| messages | General Channels | General Channels, Active Question Chats |
| message_attachments | General Channels | General Channels |
| references | Message Reference and Annotation | Message Reference and Annotation |
| channel_read_state | Unread Message Indicators | Unread Message Indicators |

## API Endpoints

| Method | Path | Mode | Story |
| --- | --- | --- | --- |
| POST | /api/auth/login | exposes | Authentication and Roles |
| POST | /api/auth/logout | exposes | Authentication and Roles |
| POST | /api/invitations/accept | exposes | Authentication and Roles |
| GET | /api/users | exposes | Authentication and Roles |
| POST | /api/users | exposes | Authentication and Roles |
| PATCH | /api/users/:id | exposes | Authentication and Roles |
| POST | /api/projects/:id/invitations | exposes | Authentication and Roles |
| POST | /api/invitations/:id/resend | exposes | Authentication and Roles |
| GET | /api/projects | exposes | Projects and External Organization Spaces |
| POST | /api/projects | exposes | Projects and External Organization Spaces |
| GET | /api/projects/:id | exposes | Projects and External Organization Spaces |
| PATCH | /api/projects/:id | exposes | Projects and External Organization Spaces |
| POST | /api/projects/:id/archive | exposes | Projects and External Organization Spaces |
| POST | /api/projects/:id/members | exposes | Projects and External Organization Spaces |
| GET | /api/projects/:id/files | exposes | File Explorer |
| POST | /api/projects/:id/files | exposes | File Explorer |
| GET | /api/files/:id/download | exposes | File Explorer |
| GET | /api/files/:id/versions | exposes | File Explorer |
| PATCH | /api/files/:id | exposes | File Explorer |
| DELETE | /api/files/:id | exposes | File Explorer |
| POST | /api/projects/:id/folders | exposes | File Explorer |
| PATCH | /api/folders/:id | exposes | File Explorer |
| DELETE | /api/folders/:id | exposes | File Explorer |
| GET | /api/projects/:id/channels | exposes | General Channels |
| POST | /api/projects/:id/channels | exposes | General Channels |
| GET | /api/channels/:id/messages | exposes | General Channels |
| POST | /api/channels/:id/messages | exposes | General Channels |
| PATCH | /api/messages/:id | exposes | General Channels |
| DELETE | /api/messages/:id | exposes | General Channels |
| GET | /api/realtime/socket | exposes | General Channels |
| GET | /api/projects/:id/questions | exposes | Active Question Chats |
| POST | /api/projects/:id/questions | exposes | Active Question Chats |
| POST | /api/questions/:id/resolve | exposes | Active Question Chats |
| DELETE | /api/questions/:id/resolve | exposes | Active Question Chats |
| GET | /api/projects/:id/unread | exposes | Unread Message Indicators |
| POST | /api/channels/:id/read | exposes | Unread Message Indicators |
| POST | /api/messages/:id/reference | exposes | Message Reference and Annotation |
| GET | /api/references/:id | exposes | Message Reference and Annotation |
| PUT | /api/references/:id | exposes | Message Reference and Annotation |
| DELETE | /api/references/:id | exposes | Message Reference and Annotation |
| GET | /api/file-versions/:id/pages/:page | exposes | Message Reference and Annotation |

## Routes

| Path | Story |
| --- | --- |
| /login | Authentication and Roles |
| /accept-invite/:token | Authentication and Roles |
| /admin/users | Authentication and Roles |
| /projects | Projects and External Organization Spaces |
| /projects/:id | Projects and External Organization Spaces |
| /projects/new | Projects and External Organization Spaces |
| /projects/:id/files | File Explorer |
| /projects/:id/files/:folderId | File Explorer |
| /projects/:id/channels/:channelId | General Channels |
| /projects/:id/questions/:channelId | Active Question Chats |
| /projects/:id | Unread Message Indicators |
| /projects/:id/references/new | Message Reference and Annotation |
| /projects/:id/references/:referenceId | Message Reference and Annotation |
