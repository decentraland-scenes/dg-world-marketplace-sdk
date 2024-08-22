import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

export function ui(): ReactEcs.JSX.Element {
  return (
    <UiEntity>
      <Label value="Hello world!" />
    </UiEntity>
  )
}
