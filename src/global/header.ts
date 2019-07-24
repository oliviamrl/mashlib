import $rdf, { Fetcher, IndexedFormula, NamedNode, sym } from "rdflib"
import namespace from "solid-namespace"
import panes from "solid-panes"
import { icon } from "./icon"
import { SolidSession } from "../../typings/solid-auth-client"
import { emptyProfile } from "./empty-profile"
import { throttle } from "../helpers/throttle"

const ns = namespace($rdf)

export async function initHeader (store: IndexedFormula, fetcher: Fetcher) {
  const pod = getPod()
  const podOwnerProfile = getProfile(pod)
  await fetcher.load(podOwnerProfile)
  const header = document.getElementById("PageHeader")
  if (!header) {
    return
  }

  panes.UI.authn.solidAuthClient.trackSession(function(session: SolidSession | null) {
    const profile = session ? sym(session.webId) : null
    header.innerHTML = ""
    buildHeader(header, store, profile, pod, podOwnerProfile)
  })
}

function buildHeader (header: HTMLElement, store: IndexedFormula, profile: NamedNode | null, pod: NamedNode, podOwnerProfile: NamedNode) {
  header.appendChild(createBanner(store, pod, profile))
  if (!profile || (profile && !profile.equals(podOwnerProfile))) {
    header.appendChild(createSubBanner(store, profile, podOwnerProfile))
  }
}

function createBanner (store: IndexedFormula, pod: NamedNode, profile: NamedNode | null): HTMLElement {
  const podLink = document.createElement("a")
  podLink.href = pod.uri
  podLink.classList.add("header-banner__link")
  podLink.innerHTML = icon

  const userMenu = profile ? createUserMenu(store, profile) : document.createElement("span")

  const banner = document.createElement("div")
  banner.classList.add("header-banner")
  banner.appendChild(podLink)
  banner.appendChild(userMenu)

  return banner
}

function openDashboardPane(pane: string) {
  const outliner = panes.getOutliner(document)
  const rows = document.querySelectorAll('#outline > tr > td > table > tr')
  if (rows.length < 2 && rows[0].parentNode) {
    const row = document.createElement('tr')
    const container = row.appendChild(document.createElement('td'))
    rows[0].parentNode.appendChild(row)
    return outliner.showDashboard(container, true)
  }
  const container = rows[rows.length - 1].childNodes[0]
  return outliner.showDashboard(container, true, pane)
}

function createUserMenuButton (label: string, onClick: EventListenerOrEventListenerObject): HTMLElement {
  const button = document.createElement('button')
  button.classList.add('header-user-menu__button')
  button.addEventListener('click', onClick)
  button.innerText = label
  return button
}

function createUserMenu (store: IndexedFormula, profile: NamedNode): HTMLElement {
  const loggedInMenuList = document.createElement("ul")
  loggedInMenuList.appendChild(createUserMenuItem(createUserMenuButton("Your stuff", () => openDashboardPane("home"))))
  loggedInMenuList.appendChild(createUserMenuItem(createUserMenuButton("Preferences", () => openDashboardPane("trustedApplications"))))
  loggedInMenuList.appendChild(createUserMenuItem(createUserMenuButton("Edit your profile", () => openDashboardPane("profile"))))
  loggedInMenuList.appendChild(createUserMenuItem(createUserMenuButton('Log out', () => panes.UI.authn.solidAuthClient.logout())))

  const loggedInMenu = document.createElement("nav")
  loggedInMenu.classList.add("header-user-menu__navigation-menu")
  loggedInMenu.setAttribute("aria-hidden", "true")
  loggedInMenu.appendChild(loggedInMenuList)

  const loggedInMenuTrigger = document.createElement("button")
  loggedInMenuTrigger.classList.add("header-user-menu__trigger")
  loggedInMenuTrigger.type = "button"
  const profileImg = getProfileImg(store, profile)
  if (typeof profileImg === "string") {
    loggedInMenuTrigger.innerHTML = profileImg
  } else {
    loggedInMenuTrigger.appendChild(profileImg)
  }

  const loggedInMenuContainer = document.createElement("div")
  loggedInMenuContainer.classList.add("header-banner__user-menu", "header-user-menu")
  loggedInMenuContainer.appendChild(loggedInMenuTrigger)
  loggedInMenuContainer.appendChild(loggedInMenu)

  const throttledMenuToggle = throttle((event: Event) => toggleMenu(event, loggedInMenuTrigger, loggedInMenu), 50)
  loggedInMenuTrigger.addEventListener("click", throttledMenuToggle)
  loggedInMenuContainer.addEventListener("mouseover", throttledMenuToggle)
  loggedInMenuContainer.addEventListener("mouseout", throttledMenuToggle)

  return loggedInMenuContainer
}

function createUserMenuItem (child: HTMLElement): HTMLElement {
  const menuProfileItem = document.createElement("li")
  menuProfileItem.classList.add("header-user-menu__list-item")
  menuProfileItem.appendChild(child)
  return menuProfileItem
}

function createSubBanner (store: IndexedFormula, profile: NamedNode | null, powOwnerProfile: NamedNode): HTMLElement {
  const profileLinkPre = document.createElement("span")
  profileLinkPre.innerText = "You're visiting the Pod controlled by "

  const profileLink = document.createElement("a")
  profileLink.href = powOwnerProfile.uri
  profileLink.classList.add("header-aside__link")
  profileLink.innerText = getName(store, powOwnerProfile)

  const profileLinkContainer = document.createElement("aside")
  profileLinkContainer.classList.add("header-aside")
  profileLinkContainer.appendChild(profileLinkPre)
  profileLinkContainer.appendChild(profileLink)

  if (!profile) {
    const profileLoginButtonPre = document.createElement("span")
    profileLoginButtonPre.innerText = " - "

    const profileLoginButton = document.createElement("button")
    profileLoginButton.type = "button"
    profileLoginButton.innerText = "Log in"
    profileLoginButton.addEventListener("click", () => panes.UI.authn.solidAuthClient.popupLogin())

    profileLinkContainer.appendChild(profileLoginButtonPre)
    profileLinkContainer.appendChild(profileLoginButton)
  }
  return profileLinkContainer
}

function getName (store: IndexedFormula, profile: NamedNode): string {
  return (store.anyValue as any)(profile, ns.vcard("fn"), null, profile.doc()) ||
    (store.anyValue as any)(profile, ns.foaf("name"), null, profile.doc()) ||
    profile.uri
}

function getPod (): NamedNode {
  // TODO: This is given that mashlib runs on NSS - might need to change when we want it to run on other Pod servers
  return sym(document.location.origin)
}

function getProfile (origin: NamedNode): NamedNode {
  // TODO: This is given the structure that NSS provides - might need to change for other Pod servers
  return sym(`${origin.uri}/profile/card#me`)
}

function getProfileImg (store: IndexedFormula, profile: NamedNode): string | HTMLElement {
  const hasPhoto = (store.anyValue as any)(profile, ns.vcard("hasPhoto"), null, profile.doc())
  if (!hasPhoto) {
    return emptyProfile
  }
  const profileImage = document.createElement("div")
  profileImage.classList.add("header-user-menu__photo")
  profileImage.style.backgroundImage = `url("${hasPhoto}")`
  return profileImage
}

function toggleMenu (event: Event, trigger: HTMLButtonElement, menu: HTMLElement): void {
  const isExpanded = trigger.getAttribute("aria-expanded") === "true"
  const expand = event.type === "mouseover"
  const close = event.type === "mouseout"
  if (isExpanded && expand || !isExpanded && close) {
    return
  }
  trigger.setAttribute("aria-expanded", (!isExpanded).toString())
  menu.setAttribute("aria-hidden", isExpanded.toString())
}