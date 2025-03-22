'use client'

import dynamic from 'next/dynamic'
import '@tldraw/tldraw/tldraw.css'
import { Vibe3DCodeButton } from './components/Vibe3DCodeButton'
import { APIKeyInput } from './components/APIKeyInput'
import { PreviewShapeUtil } from './PreviewShape/PreviewShape'
import { Model3DPreviewShapeUtil } from './PreviewShape/Model3DPreviewShape'

const Tldraw = dynamic(async () => (await import('@tldraw/tldraw')).Tldraw, {
	ssr: false,
})

const shapeUtils = [PreviewShapeUtil, Model3DPreviewShapeUtil]

export default function App() {
	return (
		<div className="editor">
			<Tldraw 
				persistenceKey="vibe-3d-code" 
				shareZone={
					<div style={{ display: 'flex' }}>
						<Vibe3DCodeButton />
					</div>
				} 
				shapeUtils={shapeUtils}
			>
				<APIKeyInput />
			</Tldraw>
		</div>
	)
}
