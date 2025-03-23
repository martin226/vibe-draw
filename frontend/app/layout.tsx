import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'Vibe Draw',
	description: 'draw a 3d model and make it real',
	manifest: '/manifest.json',
	icons: [
		{
			rel: 'icon',
			url: '/icon.jpeg',
		},
	],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body className={inter.className}>{children}</body>
		</html>
	)
}
