export default class ConcurrentUsers {
    constructor(app) {
        this.maxUsersShow = 5;
        this.concurrentUsersElement = document.querySelector(
            '#exe-concurrent-users'
        );
        this.currentUsersJson = null;
        this.currentUsers = null;
        this.intervalTime = 3500;
        this.app = app;
    }

    async updateConcurrentUsers(event) {
        let message = event.detail;

        console.log('new-user-editing, actualizando usuarios');
        // Remove last users to add current users
        if (event.detail.user != this.app.user.name) {
            let userDiv = this.concurrentUsersElement.querySelectorAll('div');
            // if (userDiv) {
            //   userDiv.forEach(function (childDiv) {
            //     childDiv.parentElement.removeChild(childDiv);
            //   });
            // }
            // Update user info menu
            await this.loadConcurrentUsers();
            await this.addConcurrentUsersToElement();
            await this.addEventClickButtonMore();
            // Update user info modal only if it's open
            let bodyConcurrentUsers = document.querySelector(
                'div.exe-concurrent-users'
            );
            if (bodyConcurrentUsers) {
                bodyConcurrentUsers.innerHTML = '';
                this.getConcurrentUsersElementsList().forEach(
                    (concurrentUserElement) => {
                        bodyConcurrentUsers.append(concurrentUserElement);
                    }
                );
            }
        }
    }

    /**
     * Init element
     *
     */
    async init() {
        // Initialize users on the first time
        await this.loadConcurrentUsers();
        this.addConcurrentUsersToElement();
        this.addEventClickButtonMore();

        // These event handlers are redundant, as they both perform the same action. However,
        // they respond to different events, and in the future, it may be necessary to take distinct actions
        // depending on whether the user enters or exits the application.
        window.addEventListener('new-user-editing', async (event) => {
            this.updateConcurrentUsers(event);
        });

        window.addEventListener('user-exiting', async (event) => {
            this.updateConcurrentUsers(event);
        });
    }

    /**
     * Load session concurrent users from api
     *
     */
    async loadConcurrentUsers() {
        let odeId = eXeLearning.app.project.odeId;
        let odeVersion = eXeLearning.app.project.odeVersion;
        let odeSession = eXeLearning.app.project.odeSession;
        this.currentUsersJson = await eXeLearning.app.api.getOdeConcurrentUsers(
            odeId,
            odeVersion,
            odeSession
        );
        this.currentUsers = this.currentUsersJson.currentUsers;
    }

    /**
     * Add concurrent users elements to container
     *
     */
    addConcurrentUsersToElement() {
        const titleElement = this.concurrentUsersElement.querySelector(
            '#title-exe-concurrent-users'
        );
        const numUsers = this.currentUsers ? this.currentUsers.length : 1;
        titleElement.textContent = `${_('Users online')} (${numUsers})`;
        this.getConcurrentUsersElementsList().forEach(
            (concurrentUserElement) => {
                this.concurrentUsersElement.append(concurrentUserElement);
            }
        );
        if (this.currentUsers) {
            const numUsers = this.currentUsers.length;
            this.concurrentUsersElement.setAttribute('num', numUsers);
            this.concurrentUsersElement.setAttribute(
                'show-more-button',
                numUsers > 1
            );
        }
    }

    /**
     * Get list of concurrent users elements
     *
     * @returns {Array}
     */
    getConcurrentUsersElementsList() {
        let concurrentUsersElements = [];
        if (this.currentUsers) {
            this.currentUsers.forEach((user) => {
                let initials = user.initials.toUpperCase();
                let username = user.username;
                let nodeConcurrentUser = document.createElement('div');
                nodeConcurrentUser.classList.add('user-current-letter-icon');
                nodeConcurrentUser.classList.add('exe-top-icons');
                nodeConcurrentUser.setAttribute('title', username);

                if (user.gravatarUrl) {
                    // Inject a img element with the gravatar url
                    const img = document.createElement('img');
                    img.className = 'exe-gravatar rounded-circle';
                    img.src = user.gravatarUrl;
                    img.alt = '';
                    img.height = 50;
                    img.width = 50;

                    nodeConcurrentUser.appendChild(img);
                } else {
                    nodeConcurrentUser.innerText = initials;
                }

                concurrentUsersElements.push(nodeConcurrentUser);
            });
        }
        return concurrentUsersElements;
    }

    /**
     * Add event click to "more" button
     *
     */
    addEventClickButtonMore() {
        let buttonMore = this.concurrentUsersElement.querySelector(
            '#button-more-exe-concurrent-users'
        );
        if (this.currentUsers.length > 1) {
            buttonMore.style.display = 'block';
        } else {
            buttonMore.style.display = 'none';
        }
        buttonMore.title = `${_('Users online')} (${this.currentUsers.length})`;
        buttonMore.addEventListener('click', () => {
            // Show modal
            eXeLearning.app.modals.info.show({
                title: `${_('Users online')} (${this.currentUsers.length})`,
                body: this.makeBodyHTMLConcurrentUsersModal(),
            });
            // Add tooltips
            $('#modalInfo').on('shown.bs.modal', function () {
                $('.exe-concurrent-users > div').tooltip();
            });
        });
    }

    /**
     * Make body of concurrent users modal
     *
     */
    makeBodyHTMLConcurrentUsersModal() {
        let bodyConcurrentUsers = document.createElement('div');
        bodyConcurrentUsers.classList.add('exe-concurrent-users');
        this.getConcurrentUsersElementsList().forEach(
            (concurrentUserElement) => {
                bodyConcurrentUsers.append(concurrentUserElement);
            }
        );

        return bodyConcurrentUsers.outerHTML;
    }
}
