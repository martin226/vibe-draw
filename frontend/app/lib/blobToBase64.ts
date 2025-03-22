export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, _) => {
		const reader = new FileReader()
		reader.onloadend = () => {
			const result = reader.result as string
			// Remove the data URL prefix (like "data:image/png;base64,") and return only the base64 content
			const base64Content = result.split(',')[1]
			resolve(base64Content)
		}
		reader.readAsDataURL(blob)
	})
}
