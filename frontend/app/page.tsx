'use client'

import dynamic from 'next/dynamic'
import './tldraw.css'
import { Vibe3DCodeButton } from './components/Vibe3DCodeButton'
import { AutoDrawButton } from './components/AutoDrawButton'
import { ImproveDrawingButton } from './components/ImproveDrawingButton'
import { PreviewShapeUtil } from './PreviewShape/PreviewShape'
import { Model3DPreviewShapeUtil } from './PreviewShape/Model3DPreviewShape'
import ThreeJSCanvas from './components/three/canvas'
import { useTabStore } from './store/appStore'
import TestAddCodeButton from './components/TestAddCodeButton'
import { TldrawLogo } from './components/TldrawLogo'

const Tldraw = dynamic(async () => (await import('@tldraw/tldraw')).Tldraw, {
	ssr: false,
})

const shapeUtils = [PreviewShapeUtil, Model3DPreviewShapeUtil]

type TabType = 'tldraw' | 'threejs'

interface TabGroupProps {
	activeTab: TabType;
	setActiveTab: (tab: TabType) => void;
}

const TabGroup = ({ activeTab, setActiveTab }: TabGroupProps) => {
	return (
		<div style={{
			position: 'fixed', 
			top: '20px', 
			left: '50%', 
			transform: 'translateX(-50%)',
			zIndex: 9999999, 
			display: 'flex',
			gap: '6px',
			padding: '6px',
			borderRadius: '8px',
			backgroundColor: 'white',
			boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
		}}>
			<button 
				style={{
					padding: '6px 12px', 
					border: 'none', 
					borderRadius: '4px',
					backgroundColor: activeTab === 'tldraw' ? '#007bff' : '#f0f0f0', 
					color: activeTab === 'tldraw' ? 'white' : 'black',
					cursor: 'pointer',
					transition: 'background-color 0.2s'
				}}
				onClick={() => setActiveTab('tldraw')}
			>
				2D Canvas
			</button>
			<button 
				style={{
					padding: '6px 12px', 
					border: 'none', 
					borderRadius: '4px',
					backgroundColor: activeTab === 'threejs' ? '#007bff' : '#f0f0f0', 
					color: activeTab === 'threejs' ? 'white' : 'black',
					cursor: 'pointer',
					transition: 'background-color 0.2s'
				}}
				onClick={() => setActiveTab('threejs')}
			>
				3D World
			</button>
		</div>
	)
}

export default function App() {
	const { activeTab, setActiveTab } = useTabStore()

	return (
		<>
			<TabGroup activeTab={activeTab} setActiveTab={setActiveTab} />
			<div className="editor">
				<div style={{ 
					position: 'absolute', 
					width: '100%', 
					height: '100%', 
					visibility: activeTab === 'tldraw' ? 'visible' : 'hidden',
					zIndex: activeTab === 'tldraw' ? 2 : 1
				}}>
					<Tldraw 
						persistenceKey="vibe-3d-code" 
						shareZone={
							<div style={{ display: 'flex' }}>
								<Vibe3DCodeButton />
								<ImproveDrawingButton />
								<AutoDrawButton />
							</div>
						} 
						shapeUtils={shapeUtils}
					>
						<TldrawLogo />
					</Tldraw>
				</div>
				<ThreeJSCanvas visible={activeTab === 'threejs'} />
			</div>
			<TestAddCodeButton activeTab={activeTab} setActiveTab={setActiveTab} />
		</>
	)
}
