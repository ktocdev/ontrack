import { Avatar } from '../../components/Avatar'
import { PhotoThumb } from '../../components/Photo'
import { ThreadEvent, ThreadMessage } from '../../components/Thread'
import { useAvatarUrl } from '../profile/useProfile'
import type { ThreadItem } from './thread'

/** A ticket's thread: its events and messages, with each message's photos, shared by the manager and Ops screens. */
type Open = (photo: { src: string; alt: string }) => void

export function ThreadFeed({
  items,
  photos,
  urls,
  onOpen,
}: {
  items: ThreadItem[]
  photos: { path: string; update_id: string | null }[]
  urls: Map<string, string> | undefined
  onOpen: Open
}) {
  return (
    <div role="log" aria-label="Ticket updates" className="flex flex-none flex-col">
      {items.map((item) =>
        item.type === 'event' ? (
          <ThreadEvent key={item.key} text={item.text} when={item.when} />
        ) : (
          <Message
            key={item.key}
            item={item}
            paths={photos.filter((p) => p.update_id === item.updateId).map((p) => p.path)}
            urls={urls}
            onOpen={onOpen}
          />
        ),
      )}
    </div>
  )
}

function Message({
  item,
  paths,
  urls,
  onOpen,
}: {
  item: Extract<ThreadItem, { type: 'message' }>
  paths: string[]
  urls: Map<string, string> | undefined
  onOpen: Open
}) {
  const photo = useAvatarUrl(item.avatarPath)
  return (
    <ThreadMessage
      who={item.who}
      when={item.when}
      mine={item.mine}
      internal={item.internal}
      avatar={<Avatar name={item.name} role={item.role} size={30} src={photo.data} />}
      photos={
        paths.length > 0
          ? paths.map((path) => {
              const src = urls?.get(path)
              const alt = `Photo from ${item.mine ? 'You' : item.name}`
              return (
                <PhotoThumb
                  key={path}
                  src={src}
                  alt={alt}
                  tinted={item.mine}
                  onOpen={() => src && onOpen({ src, alt })}
                />
              )
            })
          : undefined
      }
    >
      {item.text}
    </ThreadMessage>
  )
}
