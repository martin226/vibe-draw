import { useObjectStore } from '@/store/appStore'
import { useState } from 'react'

type TabType = 'tldraw' | 'threejs'

interface TestAddCodeButtonProps {
	activeTab: TabType
	setActiveTab: (tab: TabType) => void
}

export default function TestAddCodeButton({ activeTab, setActiveTab }: TestAddCodeButtonProps) {
	const { addObjectFromCode } = useObjectStore()
	const [message, setMessage] = useState<string | null>(null)
	
	const handleAddCode = () => {
		const result = addObjectFromCode(`
			// Create a new cube with a random color
			const colors = [0x00ff00, 0xff0000, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
			const randomColor = colors[Math.floor(Math.random() * colors.length)];
			
			const cube = new THREE.Mesh(
				new THREE.BoxGeometry(1, 1, 1),
				new THREE.MeshStandardMaterial({ color: randomColor })
			);
			
			// Position in front of the camera
			cube.position.set(0, 1.5, -3);
            
            return cube;
		`)
		
		if (result) {
			// If currently in 2D view, show message about switching to 3D
			if (activeTab === 'tldraw') {
				setMessage('Object added! Switching to 3D World...')
				setTimeout(() => {
					setActiveTab('threejs')
					setTimeout(() => setMessage(null), 1000)
				}, 500)
			} else {
				setMessage('Object added!')
				setTimeout(() => setMessage(null), 2000)
			}
		} else {
			setMessage('Failed to add object.')
			setTimeout(() => setMessage(null), 3000)
		}
	}

	return (
		<>
			{/* <button
				className="vibe3DCodeButton"
				style={{
					position: 'fixed',
					zIndex: 10000,
					bottom: '80px',
					right: '20px',
					padding: '6px 12px',
					fontWeight: '400',
					backgroundColor: '#007bff',
					color: 'white',
					borderRadius: '4px',
					cursor: 'pointer',
					fontSize: '18px'
				}}
				onClick={handleAddCode}
			>
				Add Code
			</button> */}
			
			{message && (
				<div style={{
					position: 'fixed',
					zIndex: 10001,
					bottom: '140px',
					right: '20px',
					padding: '10px',
					backgroundColor: 'rgba(0,0,0,0.7)',
					color: 'white',
					borderRadius: '5px',
					maxWidth: '250px',
					fontSize: '14px'
				}}>
					{message}
				</div>
			)}
		</>
	)
}
