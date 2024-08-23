import ReactEcs, { Label, UiEntity } from '@dcl/sdk/react-ecs'

export function ui(): ReactEcs.JSX.Element {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        alignContent: 'center',
        height: '100%'
      }}
    >
      <Label value="Hello world!" />
    </UiEntity>
  )
}
