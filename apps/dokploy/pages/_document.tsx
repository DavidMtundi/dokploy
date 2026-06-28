import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
	return (
		<Html lang="en" className="font-sans">
		<Head>
				<link rel="icon" href="/icon.svg" />
				<title>VPS Hoster</title>
				<meta
					name="description"
					content="Self-hosted deploy platform — Railway experience on your VPS"
				/>
			</Head>
			<body className="flex h-full w-full flex-col font-sans">
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
