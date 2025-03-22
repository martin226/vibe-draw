import { Grid } from '@react-three/drei'

export function InfiniteGrid() {
  return (
    <Grid
      args={[30, 30]}
      cellThickness={1.2}
      cellColor="#6f6f6f"
      sectionSize={5}
      sectionThickness={1.8}
      sectionColor="#000000"
      fadeDistance={100}
      fadeStrength={0.8}
      infiniteGrid
      followCamera={false}
    />
  )
}
