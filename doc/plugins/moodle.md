# eXeLearning in Moodle

[Leer en español](moodle.es.md){ .lang-switch }

<!-- --8<-- [start:guide] -->

There are **three** eXeLearning plugins for Moodle. They install the same way and can live side by
side on the same site.

| In the activity chooser | Plugin | Use it for… | Grades |
| --- | --- | --- | --- |
| **eXeLearning resource** | [`mod_exelearning`](#mod_exelearning) | Graded interactive activities. **Recommended.** | One column per exercise |
| **eXeLearning (SCORM)** | [`mod_exescorm`](#mod_exescorm) | Content that must be a SCORM 1.2 package | One overall grade |
| **eXeLearning (website)** | [`mod_exeweb`](#mod_exeweb) | Reference material, no grade | Not graded |

!!! tip "Try it before installing"
    Each plugin has a demo in [Moodle Playground](https://moodle-playground.com/) that opens in your
    browser. The links are in the [overview](index.md#try-them-without-installing-anything).

## Requirements

| Plugin | Moodle | Release file |
| --- | --- | --- |
| `mod_exelearning` | 4.5 or later | [`mod_exelearning-X.Y.Z.zip`](https://github.com/exelearning/moodle-mod_exelearning/releases/latest) |
| `mod_exescorm` | 4.2 or later | [`mod_exescorm-X.Y.Z.zip`](https://github.com/exelearning/mod_exescorm/releases/latest) |
| `mod_exeweb` | 4.2 or later | [`mod_exeweb-X.Y.Z.zip`](https://github.com/exelearning/mod_exeweb/releases/latest) |

Each ZIP is about 30 MB because it **includes the eXeLearning editor**. If your Moodle limits the
upload size, raise it or install the plugin by unzipping it into the server's `mod/` folder.

## Installation (all three plugins) { #installation }

You need a Moodle **site administrator** account.

1. Download the latest release ZIP from the [requirements](#requirements) table.
2. Go to **Site administration → Plugins → Install plugins**, drop the ZIP into **ZIP package** and
   click **Install plugin from the ZIP file**.

    ![Install plugins with the ZIP selected](img/moodle/install-upload.png)

3. Moodle checks the package. If validation passes, click **Continue** (and **Continue** again on the
   server checks page).

    ![Plugin validation report](img/moodle/install-validation.png)

4. Click **Upgrade Moodle database now**. When it finishes, click **Continue** and, on the **New
   settings** page, **Save changes**.

    ![Upgrade the Moodle database](img/moodle/install-upgrade.png)

Repeat for each plugin you want to use. Once installed, they appear under **+ → Activity or resource**
in every course:

![The eXeLearning plugins in the activity chooser](img/moodle/activity-chooser.png)

!!! note "Manual installation"
    If you cannot upload the ZIP from the web, unzip it on the server (`mod/exelearning`,
    `mod/exescorm` or `mod/exeweb`) and visit **Site administration → Notifications**.

---

## eXeLearning resource (`mod_exelearning`) { #mod_exelearning }

Create, edit and **grade** eXeLearning resources inside Moodle. The resource keeps its own side menu
and **each graded exercise gets its own column** in the gradebook (or a single overall grade, if you
prefer).

**Configuration:** none. It works right after installation. In **Site administration → Plugins →
Activity modules → eXeLearning resource** you can disable the embedded editor or manage the available
styles.

### Create an activity

1. In the course, turn **Edit mode** on, click **+ → Activity or resource** and choose **eXeLearning
   resource**.
2. Type a name. If you already have the resource, upload it in **Package file**. If you leave it empty,
   the activity starts blank and you build it with the editor.
3. Under **Grade**, choose one column per exercise or one overall grade (**Gradebook columns**) and,
   under **Attempts management**, how many attempts are allowed and how they are graded.

    ![Activity form with the package uploaded](img/moodle/exelearning-form.png)

4. Click **Save and display**. Moodle detects the graded exercises and creates their columns.

### Edit the content

On the activity page, click **Edit with eXeLearning**:

![Activity page with the Edit with eXeLearning button](img/moodle/exelearning-view.png)

The editor opens full screen. When you are done, click **Save to Moodle**: students see the new
version and the grade columns update themselves.

![The eXeLearning editor inside Moodle](img/moodle/exelearning-editor.png)

### See the results

Scores go to the course **gradebook**, with one column per exercise:

![One column per exercise in the gradebook](img/moodle/exelearning-grades.png)

From the activity, **View attempts report** shows the detail for each student, attempt and exercise:

![Attempts report](img/moodle/exelearning-report.png)

!!! tip "Try as a student"
    **Try as a student (preview)** shows the activity exactly as students will see it. Answers given in
    the preview are not saved.

!!! info "Exercises that are graded"
    True or false, guess, quick questions, drag and drop, fill in the blanks, classify, relate, sort,
    identify, discover, crossword, word search, puzzle, trivia, A-Z quiz, math problems and operations,
    and scrambled list.

---

## eXeLearning (SCORM) (`mod_exescorm`) { #mod_exescorm }

Create and edit eXeLearning content that Moodle plays as a **SCORM 1.2 package**, with attempts, score
and completion, and **one overall grade** in the gradebook.

### Configuration (required)

After installation the plugin expects an **eXeLearning Online** server. To use the bundled editor
instead:

1. Go to **Site administration → Plugins → Activity modules → eXeLearning (SCORM)**.
2. Set **Editor mode** to **Integrated editor (embedded)** and save.

![Embedded editor mode in eXeLearning (SCORM)](img/moodle/exescorm-settings.png)

!!! note "Do you run an eXeLearning Online server?"
    Keep **eXeLearning Online (remote server)** and fill in the **Remote URI** and **Signing key** of
    your server. See [Deployment](../deployment.md) to install one.

### Create an activity

1. **+ → Activity or resource → eXeLearning (SCORM)**.
2. Under **Package → Type**, choose **Create with eXeLearning** to start from scratch, or **Uploaded
   package** to upload a SCORM `.zip` or an `.elpx`.

    ![eXeLearning (SCORM) activity form](img/moodle/exescorm-form.png)

3. Save. On the activity page, **Edit with eXeLearning** opens the editor; save with **Save to
   Moodle**.

    ![eXeLearning (SCORM) activity page](img/moodle/exescorm-view.png)

!!! warning "If you upload an `.elpx`"
    Open it once with **Edit with eXeLearning** and save it, so it is converted into a SCORM package.
    Students cannot play it until then.

Students click **Enter** and Moodle tracks their progress. Results are in **Reports** and in the
gradebook.

![The SCORM package in the Moodle player](img/moodle/exescorm-player.png)

---

## eXeLearning (website) (`mod_exeweb`) { #mod_exeweb }

Shows eXeLearning content as a **website** embedded in the course, with its own menu. **It does not
grade**; it only records that the resource was viewed (activity completion).

### Configuration (required)

Same as the SCORM plugin:

1. Go to **Site administration → Plugins → Activity modules → eXeLearning (website)**.
2. Set **Editor mode** to **Integrated editor (embedded)** and save.

![Embedded editor mode in eXeLearning (website)](img/moodle/exeweb-settings.png)

### Create a resource

1. **+ → Activity or resource → eXeLearning (website)**.
2. Under **Package → Type**, choose **Create with eXeLearning (embedded editor)** or **Uploaded
   package** (`.zip` or `.elpx`).

    ![eXeLearning (website) form](img/moodle/exeweb-form.png)

3. Save. The content is shown on the page; **Edit with eXeLearning** opens the editor.

![The eXeLearning website embedded in the course](img/moodle/exeweb-view.png)

---

## Frequently asked questions { #faq }

**The Edit with eXeLearning button does not appear.**
: Check that you installed the published release ZIP (the source code has no editor), that
  `mod_exescorm` and `mod_exeweb` use **Integrated editor (embedded)** mode, and that your user can
  edit the course.

**Can I move my `mod_exeweb` or `mod_exescorm` activities to `mod_exelearning`?**
: Yes. With `mod_exelearning` and one of the others installed, a **Migrate to eXeLearning** page
  appears in site administration.

**Do backups include the content?**
: Yes. All three plugins take part in Moodle course backup and restore.

<!-- --8<-- [end:guide] -->
