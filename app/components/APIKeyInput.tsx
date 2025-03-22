import { Icon, useBreakpoint } from '@tldraw/tldraw'
import { ChangeEvent, useCallback } from 'react'

export function APIKeyInput() {
	const breakpoint = useBreakpoint()

	// Store the API key locally, but ONLY in development mode
	const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		localStorage.setItem('vibe3dcode_anthropic_key', e.target.value)
	}, [])

	const handleQuestionMessage = useCallback(() => {
		window.alert(
			`If you have an Anthropic API key, you can put it in this input and it will be used when posting to Anthropic's Claude.\n\nSee https://console.anthropic.com/keys to get a key.\n\nPutting API keys into boxes is generally a bad idea! If you have any concerns, create an API key and then revoke it after using this site.`
		)
	}, [])

	return (
		<div className={`your-own-api-key ${breakpoint < 5 ? 'your-own-api-key__mobile' : ''}`}>
			<div className="your-own-api-key__inner">
				<div className="input__wrapper">
					<input
						id="anthropic_key"
						defaultValue={
							localStorage.getItem('vibe3dcode_anthropic_key') ?? process.env.ANTHROPIC_API_KEY ?? ''
						}
						onChange={handleChange}
						spellCheck={false}
						autoCapitalize="off"
					/>
				</div>
				<button className="question__button" onClick={handleQuestionMessage}>
					<Icon icon="question" />
				</button>
			</div>
		</div>
	)
}
