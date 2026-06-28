import { VALID_BRANCH_REGEX } from "@dokploy/server/utils/git-branch-validation";
import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { CheckIcon, ChevronsUpDown, Github, Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { GithubIcon } from "@/components/icons/data-tools-icons";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { api } from "@/utils/api";
import { APP_NAME_MESSAGE, APP_NAME_REGEX } from "@/utils/schema";

const QuickDeploySchema = z.object({
	name: z.string().min(1, "Service name is required"),
	appName: z.string().min(1).regex(APP_NAME_REGEX, APP_NAME_MESSAGE),
	githubId: z.string().min(1, "Connect GitHub first"),
	repository: z.object({
		owner: z.string().min(1),
		repo: z.string().min(1),
	}),
	branch: z
		.string()
		.min(1)
		.regex(VALID_BRANCH_REGEX, "Invalid branch name"),
});

type QuickDeployForm = z.infer<typeof QuickDeploySchema>;

interface Props {
	environmentId: string;
	projectName?: string;
	projectId: string;
}

export const QuickDeployFromGithub = ({
	environmentId,
	projectName,
	projectId,
}: Props) => {
	const router = useRouter();
	const utils = api.useUtils();
	const [open, setOpen] = useState(false);
	const slug = slugify(projectName);

	const { data: githubProviders, isLoading: loadingProviders } =
		api.github.githubProviders.useQuery(undefined, { enabled: open });

	const form = useForm<QuickDeployForm>({
		defaultValues: {
			name: "",
			appName: `${slug}-`,
			githubId: "",
			repository: { owner: "", repo: "" },
			branch: "",
		},
		resolver: zodResolver(QuickDeploySchema),
	});

	const githubId = form.watch("githubId");
	const repository = form.watch("repository");

	const { data: repositories, isPending: loadingRepos } =
		api.github.getGithubRepositories.useQuery(
			{ githubId },
			{ enabled: !!githubId && open },
		);

	const { data: branches, status: branchStatus } =
		api.github.getGithubBranches.useQuery(
			{
				owner: repository.owner,
				repo: repository.repo,
				githubId,
			},
			{
				enabled:
					!!githubId && !!repository.owner && !!repository.repo && open,
			},
		);

	const { mutateAsync: createApp, isPending: creating } =
		api.application.create.useMutation();
	const { mutateAsync: saveGithub, isPending: saving } =
		api.application.saveGithubProvider.useMutation();
	const { mutateAsync: deploy, isPending: deploying } =
		api.application.deploy.useMutation();

	const isBusy = creating || saving || deploying;
	const hasGithub = (githubProviders?.length ?? 0) > 0;

	const onSubmit = async (data: QuickDeployForm) => {
		try {
			const app = await createApp({
				name: data.name,
				appName: data.appName,
				environmentId,
			});

			await saveGithub({
				applicationId: app.applicationId,
				githubId: data.githubId,
				owner: data.repository.owner,
				repository: data.repository.repo,
				branch: data.branch,
				buildPath: "/",
				watchPaths: [],
				triggerType: "push",
				enableSubmodules: false,
			});

			await deploy({
				applicationId: app.applicationId,
				title: "Quick deploy from GitHub",
				description: `${data.repository.owner}/${data.repository.repo}@${data.branch}`,
			});

			toast.success("Deploy started", {
				description: "Building your repository…",
			});

			setOpen(false);
			form.reset();
			await utils.environment.one.invalidate({ environmentId });

			await router.push(
				`/dashboard/project/${projectId}/environment/${environmentId}/services/application/${app.applicationId}?tab=deployments`,
			);
		} catch {
			toast.error("Quick deploy failed");
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="default" className="gap-2">
					<Rocket className="h-4 w-4" />
					Deploy from GitHub
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Github className="h-5 w-5" />
						Quick deploy from GitHub
					</DialogTitle>
					<DialogDescription>
						Railway-style flow: pick a repo, branch, and deploy in one step.
					</DialogDescription>
				</DialogHeader>

				{loadingProviders ? (
					<p className="text-sm text-muted-foreground">Loading GitHub…</p>
				) : !hasGithub ? (
					<AlertBlock type="warning" title="Connect GitHub first">
						<p className="mb-3 text-sm">
							Install the GitHub App to list your repositories (same idea as
							Railway).
						</p>
						<Button asChild variant="secondary" className="gap-2">
							<Link href="/dashboard/settings/git-providers">
								<GithubIcon className="h-4 w-4" />
								Connect GitHub
							</Link>
						</Button>
					</AlertBlock>
				) : (
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="grid gap-4"
							id="quick-deploy-github"
						>
							<FormField
								control={form.control}
								name="githubId"
								render={({ field }) => (
									<FormItem>
										<FormLabel>GitHub account</FormLabel>
										<Select
											value={field.value}
											onValueChange={(v) => {
												field.onChange(v);
												form.setValue("repository", { owner: "", repo: "" });
												form.setValue("branch", "");
											}}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select account" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{githubProviders?.map((p) => (
													<SelectItem key={p.githubId} value={p.githubId}>
														{p.gitProvider.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="repository"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Repository</FormLabel>
										<Popover>
											<PopoverTrigger asChild>
												<FormControl>
													<Button
														type="button"
														variant="outline"
														className="w-full justify-between !bg-input"
													>
														{field.value.repo
															? `${field.value.owner}/${field.value.repo}`
															: loadingRepos
																? "Loading…"
																: "Select repository"}
														<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
													</Button>
												</FormControl>
											</PopoverTrigger>
											<PopoverContent className="p-0" align="start">
												<Command>
													<CommandInput placeholder="Search repos…" />
													<CommandEmpty>No repositories found.</CommandEmpty>
													<ScrollArea className="h-64">
														<CommandGroup>
															{repositories?.map((repo) => (
																<CommandItem
																	key={repo.url}
																	value={repo.name}
																	onSelect={() => {
																		form.setValue("repository", {
																			owner: repo.owner.login as string,
																			repo: repo.name,
																		});
																		form.setValue("branch", "");
																	}}
																>
																	<span>
																		{repo.owner.login}/{repo.name}
																	</span>
																	<CheckIcon
																		className={cn(
																			"ml-auto h-4 w-4",
																			repo.name === field.value.repo
																				? "opacity-100"
																				: "opacity-0",
																		)}
																	/>
																</CommandItem>
															))}
														</CommandGroup>
													</ScrollArea>
												</Command>
											</PopoverContent>
										</Popover>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="branch"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Branch</FormLabel>
										<Select value={field.value} onValueChange={field.onChange}>
											<FormControl>
												<SelectTrigger>
													<SelectValue
														placeholder={
															branchStatus === "pending"
																? "Loading…"
																: "Select branch"
														}
													/>
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{branches?.map((b) => (
													<SelectItem key={b.name} value={b.name}>
														{b.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Service name</FormLabel>
										<FormControl>
											<Input
												placeholder="my-api"
												{...field}
												onChange={(e) => {
													const val = e.target.value;
													field.onChange(val);
													form.setValue(
														"appName",
														`${slug}-${slugify(val)}`.replace(/-+$/, ""),
													);
												}}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</form>
					</Form>
				)}

				<DialogFooter>
					{hasGithub && (
						<Button
							type="submit"
							form="quick-deploy-github"
							isLoading={isBusy}
							className="gap-2"
						>
							<Rocket className="h-4 w-4" />
							Deploy
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
