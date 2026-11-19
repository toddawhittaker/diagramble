# Diagramble: Screen Briefs for Mockups

17 November 2026 · Stage 1 of the mockup work

This file describes the screens worth mocking up, in enough detail that someone who has
never seen the project could draw each one. It follows the [specification](../SPEC.md).
No screen has been built in code.

Diagramble is an app that supports the course textbook. A student builds the book's
models in it, and the app checks them and explains each problem. It is not a learning
management system. Nothing in these briefs deals with assignments, handing work in,
grading or class lists.

Terms: a data flow diagram (DFD) shows processes, data stores, external entities and the
data flowing between them. The data dictionary holds the definition of every piece of
data. A finding is one problem that a rule reports.

## 1. What every screen shares

Sizes are for a screen 1440 wide and 900 high. Colours and typefaces are not fixed here.
[STYLES.md](STYLES.md) gives three choices of look, and each one assigns a colour to
every role named below.

### 1.1 The frame

**Top bar.** Full width, 48 high. It never changes from screen to screen.

| Place | Content |
| --- | --- |
| Left | The product name "Diagramble", then the project name "Clinic appointments" |
| Right | "Saved 9:32 pm" in muted text. Then the project's problem count: an error mark with "1" and a warning mark with "2". Then the primary button "Export PDF" |

There is no user name, avatar or menu in the top bar. The chosen style adds one small
switch between "Saved 9:32 pm" and the problem count, for light and dark mode
([STYLES.md](STYLES.md)).

**Navigator.** A sidebar on the left, 216 wide, from under the top bar to the bottom. It
lists the parts of the project in a fixed order. The row for the part now open is shown
as selected.

| Row | Right end of the row |
| --- | --- |
| Use cases | 3 |
| Diagrams (a group heading for the three rows below) | |
| Context diagram (indented one step) | OK mark |
| Level 0 (indented two steps) | Warning mark, 1 |
| 1 Schedule Appointment (indented three steps) | Error mark, 1. Warning mark, 1 |
| Data dictionary | 24 |
| Help: symbols and rules (at the very bottom) | |

The diagram rows form a tree, because each diagram expands a process on the one above.
Each finding is counted once, on the diagram it belongs to, so the counts in the
navigator add up to the count in the top bar.

**Page header.** A strip across the top of the main area, 72 high. It holds a small
muted breadcrumb, the page title in large type under it, and the page's own controls at
the right end. Every editing screen has "Undo" and "Redo" there.

**Right panel.** A sidebar on the right, 390 wide, from under the top bar to the bottom.
It shows what the app knows about the thing in the main area: its problems, where it is
used, or what it links to.

**A selected item** looks the same everywhere. It has a 2-pixel outline in the selection
colour and a pale tint of that colour as its fill. A selected row in a list also has a
thick bar in the selection colour down its left edge. The current choice in a switch, a
set of tabs or the tool strip uses the same look. Nothing else uses the selection
colour.

### 1.2 The marks

Each mark means one thing and appears only where it means that. Each has a shape as well
as a colour, so that nobody has to tell them apart by colour alone.

| Mark | It means | Its look | Where it appears |
| --- | --- | --- | --- |
| Error | A rule reports a finding of severity "error" | A small solid circle in the error colour with a white exclamation mark. In a problem card it is followed by the word "Error" | Top bar, navigator, problem cards, the dictionary list, and beside the item on a diagram that the finding names |
| Warning | A rule reports a finding of severity "warning" | A small solid triangle in the warning colour with a dark exclamation mark. In a problem card it is followed by the word "Warning" | The same places as the error mark |
| OK | The rules ran and found nothing wrong with this item | A plain check mark in the OK colour, with no background | Navigator, tables that compare two things |
| Disabled | This control cannot be used right now | The control fades to the disabled grey and does not react | Buttons and tools |
| Missing | Something the rules ask for has been left empty | Muted italic words that say what is missing, such as "No description yet", over a dashed underline | Fields and table cells |
| AI | This text was written by an AI model | A small four-pointed sparkle and the letters "AI", in the AI colour. The text sits in a box with a dashed border in the AI colour | Only around text an AI model wrote |

A mark followed by a number means that many findings.

The app has no mark for "overdue" or "late", because nothing in it has a due date. It
has no status labels for a piece of work either. The only status is whether the rules
found problems, and the error, warning and OK marks show that.

### 1.3 Symbols on a diagram

The symbols follow the textbook's Gane and Sarson style. A style may change their line
weight, colour and typeface, but not their shapes.

| Symbol | Shape |
| --- | --- |
| Process | A rounded rectangle. A narrow band across the top holds its number, and its name sits below the band |
| Data store | A wide rectangle, closed on its left, top and bottom and open on its right. A small box at its left end holds its label, such as D1, followed by its name |
| External entity | A plain square-cornered rectangle holding its name |
| Data flow | A solid line with one arrowhead at the end it points to. Its label is the name of the data it carries |
| Control flow | A dotted line with one arrowhead, into a process |

### 1.4 The data set

One invented project is used on every screen. It is the clinic case from section 6.2 of
the specification, which is original to this project, with two changes that produce the
three findings below. All names are invented.

**The project.** Its name is "Clinic appointments". A veterinary clinic books
appointments, records visits and produces a daily schedule. The project was last saved
at 9:32 pm.

**What the project holds.**

| Thing | Count | Detail |
| --- | --- | --- |
| Diagrams | 3 | Context diagram, Level 0, and 1 Schedule Appointment |
| Processes | 7 | 1 on the context diagram, 3 on Level 0, 3 on the child diagram |
| External entities | 2 | Client, Veterinarian |
| Data stores | 1 | D1 Appointments |
| Data flows | 19 | 5 on the context diagram, 8 on Level 0, 6 on the child diagram |
| Data definitions | 24 | 11 structures and 13 elements |
| Use cases | 3 | One for each process on Level 0 |
| Findings | 3 | 1 error and 2 warnings |

**Context diagram.** Process 0 is "Clinic System".

| From | To | Data |
| --- | --- | --- |
| Client | 0 Clinic System | Appointment Request |
| 0 Clinic System | Client | Appointment Confirmation |
| Veterinarian | 0 Clinic System | Visit Notes |
| 0 Clinic System | Veterinarian | Visit Summary |
| 0 Clinic System | Veterinarian | Daily Schedule |

**Level 0.** Processes 1 "Schedule Appointment", 2 "Record Visit" and 3 "Produce Daily
Schedule". Data store D1 "Appointments".

| From | To | Data |
| --- | --- | --- |
| Client | 1 Schedule Appointment | Appointment Request |
| 1 Schedule Appointment | Client | Appointment Confirmation |
| 1 Schedule Appointment | D1 Appointments | Appointment Record |
| D1 Appointments | 2 Record Visit | Appointment Record |
| Veterinarian | 2 Record Visit | Visit Notes |
| 2 Record Visit | Veterinarian | Visit Summary |
| D1 Appointments | 3 Produce Daily Schedule | Appointment Record |
| 3 Produce Daily Schedule | Veterinarian | Daily Schedule |

**1 Schedule Appointment.** The child diagram of process 1. Processes 1.1 "Check
Availability", 1.2 "Book Slot" and 1.3 "Send Confirmation".

| From | To | Data |
| --- | --- | --- |
| Client | 1.1 Check Availability | Visit Details |
| Client | 1.2 Book Slot | Booking Info |
| 1.1 Check Availability | 1.2 Book Slot | Available Slot |
| 1.2 Book Slot | 1.3 Send Confirmation | Booking |
| 1.2 Book Slot | D1 Appointments | Appointment Record |
| 1.3 Send Confirmation | Client | Appointment Confirmation |

**The two changes from the specification's case.** The student made the second flow
above carry "Booking Info" where the correct model has "Client Details". The student
also left the description of process 3 empty. Every other item has a description.

**Data dictionary.** "Carried by" counts the flows that carry the definition. The counts
add up to the 19 flows.

| Name | Kind | Made of, or data type | Carried by | Part of |
| --- | --- | --- | --- | --- |
| Appointment Confirmation | Structure | Confirmation Text | 3 flows | |
| Appointment Record | Structure | Appointment Entry | 4 flows | |
| Appointment Request | Structure | Client Details, Visit Details | 2 flows | |
| Available Slot | Structure | Slot Time | 1 flow | |
| Booking | Structure | Booking Reference | 1 flow | |
| Booking Info | Structure | Booking Code | 1 flow | |
| Client Details | Structure | Client Name, Phone | No flows | Appointment Request |
| Daily Schedule | Structure | Schedule Listing | 2 flows | |
| Visit Details | Structure | Pet Name, Preferred Date, Reason for Visit | 1 flow | Appointment Request |
| Visit Notes | Structure | Notes Text | 2 flows | |
| Visit Summary | Structure | Summary Text | 2 flows | |
| Appointment Entry | Element | Text | | Appointment Record |
| Booking Code | Element | Text | | Booking Info |
| Booking Reference | Element | Text | | Booking |
| Client Name | Element | Text | | Client Details |
| Confirmation Text | Element | Text | | Appointment Confirmation |
| Notes Text | Element | Text | | Visit Notes |
| Pet Name | Element | Text | | Visit Details |
| Phone | Element | Text | | Client Details |
| Preferred Date | Element | Date | | Visit Details |
| Reason for Visit | Element | Text | | Visit Details |
| Schedule Listing | Element | Text | | Daily Schedule |
| Slot Time | Element | Date and time | | Available Slot |
| Summary Text | Element | Text | | Visit Summary |

**Use cases.**

| ID | Name | Priority | Actor | Process |
| --- | --- | --- | --- | --- |
| UC-1 | Schedule Appointment | High | Client | 1 Schedule Appointment |
| UC-2 | Record Visit | High | Veterinarian | 2 Record Visit |
| UC-3 | Produce Daily Schedule | Medium | Veterinarian | 3 Produce Daily Schedule |

**Findings.** The wording is the specification's (section 5).

| Rule | Severity | Belongs to | Message |
| --- | --- | --- | --- |
| BAL-01 | Error | 1 Schedule Appointment | 'Appointment Request' enters 'Schedule Appointment' on the parent diagram but does not fully enter this diagram. Missing: Client Details. |
| BAL-03 | Warning | 1 Schedule Appointment | 'Booking Info' crosses the edge of this diagram but not 'Schedule Appointment' on the parent diagram. |
| DFD-13 | Warning | Level 0 | 'Produce Daily Schedule' has no description. |

Why BAL-01 fires: on Level 0, "Appointment Request" enters process 1. It is made of
"Client Details" and "Visit Details". On the child diagram only "Visit Details" enters,
so "Client Details" is missing. Why BAL-03 fires: "Booking Info" enters the child
diagram, and nothing on Level 0 carries it.

| Where | Errors | Warnings |
| --- | --- | --- |
| Context diagram | 0 | 0 |
| Level 0 | 0 | 1 |
| 1 Schedule Appointment | 1 | 1 |
| Whole project | 1 | 2 |

## 2. The screens chosen, and the ones left out

| # | Screen | Why it is here |
| --- | --- | --- |
| 1 | Diagram workspace | The student spends most of their time here, and must see at a glance what is wrong and why. This is the most important screen |
| 2 | Outline view | The same diagram as a list that a keyboard-only student can edit. If this is awkward, those students cannot use the app |
| 3 | Data dictionary | Balancing depends on what each piece of data is made of, so the student must define data here without losing track of where it is used |
| 4 | Use case form | The screen with the most typing. The book starts every process model from this form |

Left out:

- **Sign-in.** The first-release student screens have none. The first deployment opens a project straight from Canvas.
- **Settings.** A plain form with nothing to read at a glance.
- **Project list.** A plain list.
- **Whole-project problems list.** A plain list of the same cards as the problems panel on screen 1.
- **Help pages.** Plain reading text.
- **PDF export.** The result is a document, not a screen.
- **Assignments, handing in, grading and class views.** Not part of the first-release student screens, and not this app's job. Canvas does them.
- **Entity relationship diagram.** It uses the frame of screen 1 with the book's own symbols. It comes in the first release and is worth a brief then.
- **CRUD matrix (create, read, update, delete).** A grid of letters that depends on the data model. It comes in the first release and is worth a brief then.
- **Second-release forms, binder and design diagrams.** The forms will follow screen 4 and the diagrams will follow screen 1.

## 3. Screen 1: Diagram workspace

**What it is for.** Drawing one data flow diagram and seeing, while drawing, what the
rules say is wrong with it.

**Who looks at it.** A student, often new to modeling. They add and connect symbols, and
they decide what to change when a problem appears.

**What must be obvious at a glance.**

1. Which diagram this is, and where it sits under the others.
2. That this diagram has one error and one warning.
3. What the error is: data that enters the process on the parent diagram does not all
   arrive here, and the missing part is "Client Details".
4. Which flow the warning is about.

**Layout.**

| Region | Size | Content |
| --- | --- | --- |
| Top bar | 1440 by 48 | As in section 1.1 |
| Navigator | 216 wide | As in section 1.1 |
| Page header | 834 by 72 | Breadcrumb, title, view switch, Undo and Redo |
| Tool strip | 72 wide, down the left edge of the work area | Six tools, stacked |
| Canvas | The rest of the work area, about 762 by 780 | The diagram |
| Problems panel | 390 wide | The findings for this diagram |

**Page header.**

- Breadcrumb: "Context diagram / Level 0 / 1 Schedule Appointment"
- Title: "1 Schedule Appointment"
- Right end: a two-part switch, "Canvas" and "Outline". Then the buttons "Undo" and "Redo".

**Tool strip.** Six tools from top to bottom, each a small icon with its label under it:
"Select", "Process", "Data store", "External entity", "Data flow", "Control flow".

**Canvas.** One diagram, drawn large and centred. It has five shapes and six arrows.

| Shape | Place | Words on it |
| --- | --- | --- |
| External entity | Left, halfway down | "Client" |
| Process | Middle column, top | "1.1" in the band, "Check Availability" below |
| Process | Middle column, centre | "1.2" in the band, "Book Slot" below |
| Process | Middle column, bottom | "1.3" in the band, "Send Confirmation" below |
| Data store | Right, level with process 1.2 | "D1" in the box, then "Appointments" |

| Arrow | From | To | Label |
| --- | --- | --- | --- |
| 1 | Client | 1.1 | "Visit Details" |
| 2 | Client | 1.2 | "Booking Info", followed by a warning mark |
| 3 | 1.1 | 1.2, downward | "Available Slot" |
| 4 | 1.2 | 1.3, downward | "Booking" |
| 5 | 1.2 | D1, to the right | "Appointment Record" |
| 6 | 1.3 | Client | "Appointment Confirmation" |

No arrows cross. In the bottom left corner of the canvas is a small zoom control:
"− 100% +".

**Problems panel,** from top to bottom.

- Heading: "Problems"
- Two tabs: "This diagram 2" and "Whole project 3"
- First problem card, opened out:
  - Error mark, "Error", "BAL-01"
  - In bold: "'Appointment Request' enters 'Schedule Appointment' on the parent diagram but does not fully enter this diagram. Missing: Client Details."
  - Label "Why", then: "A child diagram is a closer look at one process, so the same data must cross its edge."
  - Label "How to fix", then: "Add a flow carrying the missing data, or remove it from the parent."
  - A small table headed "Appointment Request is made of":

    | Part | On this diagram |
    | --- | --- |
    | Client Details | "Missing", with an error mark |
    | Visit Details | "Enters at 1.1", with an OK mark |

  - An AI box. First line: the AI mark and "AI explanation". Text: "Level 0 says a client sends an Appointment Request. Your dictionary says that request is made of Client Details and Visit Details. Only Visit Details arrives on this diagram."
  - A text link: "Open parent diagram"
- Second problem card, closed:
  - Warning mark, "Warning", "BAL-03"
  - "'Booking Info' crosses the edge of this diagram but not 'Schedule Appointment' on the parent diagram."

**The state shown.**

- Selected: the navigator row "1 Schedule Appointment", "Canvas" in the switch, the "Select" tool, the tab "This diagram 2", and the first problem card. Nothing on the canvas is selected.
- Disabled: "Redo", because nothing has been undone.
- Missing: nothing on this screen.
- AI: the one box in the first problem card.

## 4. Screen 2: Outline view

**What it is for.** Editing the same diagram as a list, with the keyboard alone.

**Who looks at it.** A student who cannot or does not want to use a mouse, including one
using a screen reader. They add items, connect them with flows, and fix problems,
without dragging anything.

**What must be obvious at a glance.**

1. That this is the same diagram as screen 1, in another form.
2. Every item on the diagram and every flow, each on one line.
3. Which line is being edited, and which keys do what.

**Layout.**

| Region | Size | Content |
| --- | --- | --- |
| Top bar | 1440 by 48 | As in section 1.1 |
| Navigator | 216 wide | As in section 1.1 |
| Page header | 834 by 72 | The same as screen 1 |
| Outline | 834 wide, about 730 high | Two lists, "Items" and "Flows" |
| Key bar | 834 by 50, along the bottom of the work area | The keys |
| Problems panel | 390 wide | The findings for this diagram |

There is no tool strip on this screen.

**Page header.** The same words as screen 1.

**Outline.** Two lists, one under the other.

The first list has the heading "Items", the count "5", and at the right the button
"Add item".

| Kind (muted) | Name | Flows (muted, right end) |
| --- | --- | --- |
| External entity | Client | 1 in · 2 out |
| Process | 1.1 Check Availability | 1 in · 1 out |
| Process | 1.2 Book Slot | 2 in · 2 out |
| Process | 1.3 Send Confirmation | 1 in · 1 out |
| Data store | D1 Appointments | 1 in · 0 out |

"In" counts the flows that arrive at the item on this diagram. The "in" figures add up
to 6 and so do the "out" figures, one for each end of the six flows.

The second list has the heading "Flows", the count "6", and at the right the button
"Add flow". Its column headings are "Data", "From" and "To".

| Data | From | To |
| --- | --- | --- |
| Visit Details | Client | 1.1 Check Availability |
| Booking Info, followed by a warning mark | Client | 1.2 Book Slot |
| Available Slot | 1.1 Check Availability | 1.2 Book Slot |
| Booking | 1.2 Book Slot | 1.3 Send Confirmation |
| Appointment Record | 1.2 Book Slot | D1 Appointments |
| Appointment Confirmation | 1.3 Send Confirmation | Client |

The second row is being edited. Its three cells have become three boxes with a small
label above each: "Carries" holding "Booking Info", "From" holding "Client", and "To"
holding "1.2 Book Slot". Each box has a small downward arrow at its right end. Under the
"Carries" box, in muted text: "Type to search the dictionary". At the right end of the
row are the buttons "Done" and "Cancel".

**Key bar.** Six pairs, each a key in a small box followed by what it does:
"↑ ↓" "Move", "Enter" "Edit", "N" "Add item", "F" "Add flow", "Delete" "Remove",
"?" "All keys".

**Problems panel,** from top to bottom.

- Heading: "Problems"
- Two tabs: "This diagram 2" and "Whole project 3"
- First problem card, closed:
  - Error mark, "Error", "BAL-01"
  - "'Appointment Request' enters 'Schedule Appointment' on the parent diagram but does not fully enter this diagram. Missing: Client Details."
- Second problem card, opened out:
  - Warning mark, "Warning", "BAL-03"
  - In bold: "'Booking Info' crosses the edge of this diagram but not 'Schedule Appointment' on the parent diagram."
  - Label "Why", then: "A child diagram adds detail, so it may show flows its parent leaves out. But data that enters or leaves the process usually belongs on the parent too."
  - Label "How to fix", then: "If the parent should show this data, add the flow there or define it as part of a parent flow. If it is detail the parent leaves out, no change is needed."

**The state shown.**

- Selected: the navigator row "1 Schedule Appointment", "Outline" in the switch, the tab "This diagram 2", the "Booking Info" row, and the second problem card. Choosing a row chooses the finding about it.
- Disabled: "Redo".
- Missing: nothing on this screen.
- AI: nothing on this screen.

## 5. Screen 3: Data dictionary

**What it is for.** Defining each piece of data once: what it is made of, and where it
is used.

**Who looks at it.** A student. They decide what a flow's data is made of, which is what
decides whether a child diagram balances with its parent.

**What must be obvious at a glance.**

1. What "Appointment Request" is made of: two parts, which come to five elements in the end.
2. Where it is used: two flows.
3. That one problem names it, and that "Booking Info" has a problem too.

**Layout.**

| Region | Size | Content |
| --- | --- | --- |
| Top bar | 1440 by 48 | As in section 1.1 |
| Navigator | 216 wide | As in section 1.1 |
| List | 300 wide | All 24 definitions |
| Page header | 534 by 72 | Above the detail |
| Detail | 534 wide | The chosen definition |
| Right panel | 390 wide | Where it is used, and its problems |

**List.** At the top, a search box holding the muted words "Search 24 definitions", and
under it the button "New definition". Then two groups. The list scrolls. All of the
first group and the first rows of the second can be seen.

The first group has the heading "Structures" and the count "11".

| Name | Used (muted, right end) |
| --- | --- |
| Appointment Confirmation | 3 flows |
| Appointment Record | 4 flows |
| Appointment Request, followed by an error mark | 2 flows |
| Available Slot | 1 flow |
| Booking | 1 flow |
| Booking Info, followed by a warning mark | 1 flow |
| Client Details | In 1 structure |
| Daily Schedule | 2 flows |
| Visit Details | 1 flow · in 1 structure |
| Visit Notes | 2 flows |
| Visit Summary | 2 flows |

The second group has the heading "Elements" and the count "13".

| Name | Used (muted, right end) |
| --- | --- |
| Appointment Entry | In 1 structure |
| Booking Code | In 1 structure |
| Booking Reference | In 1 structure |
| Client Name | In 1 structure |
| Confirmation Text | In 1 structure |
| Notes Text | In 1 structure |
| Pet Name | In 1 structure |
| Phone | In 1 structure |
| Preferred Date | In 1 structure |
| Reason for Visit | In 1 structure |
| Schedule Listing | In 1 structure |
| Slot Time | In 1 structure |
| Summary Text | In 1 structure |

**Page header.**

- Breadcrumb: "Data dictionary"
- Title: "Appointment Request"
- Right end: the buttons "Undo" and "Redo".

**Detail,** from top to bottom.

- A field labelled "Name" holding "Appointment Request".
- A line labelled "Kind" reading "Data structure".
- A field labelled "Description" holding "What a client gives the clinic to ask for an appointment."
- A table headed "Made of", with the button "Add part" under it:

  | Part | Kind | Occurs |
  | --- | --- | --- |
  | Client Details | Structure | Once |
  | Visit Details | Structure | Once |

- A table headed "In the end, 5 elements":

  | Element | Data type | Comes from |
  | --- | --- | --- |
  | Client Name | Text | Client Details |
  | Phone | Text | Client Details |
  | Pet Name | Text | Visit Details |
  | Preferred Date | Date | Visit Details |
  | Reason for Visit | Text | Visit Details |

**Right panel,** from top to bottom.

- Heading: "Where used"
- Sub-heading: "Carried by 2 flows"

  | Diagram | Flow |
  | --- | --- |
  | Context diagram | Client → 0 Clinic System |
  | Level 0 | Client → 1 Schedule Appointment |

- Sub-heading: "Part of", then in muted text: "No other structure"
- Heading: "Problems", with the count "1"
- One problem card, closed:
  - Error mark, "Error", "BAL-01"
  - "'Appointment Request' enters 'Schedule Appointment' on the parent diagram but does not fully enter this diagram. Missing: Client Details."
  - A text link: "Open 1 Schedule Appointment"

**The state shown.**

- Selected: the navigator row "Data dictionary" and the list row "Appointment Request".
- Disabled: "Redo".
- Missing: nothing on this screen.
- AI: nothing on this screen.

## 6. Screen 4: Use case form

**What it is for.** Writing a use case on the book's form, and seeing whether the
diagrams agree with it.

**Who looks at it.** A student. They type the steps of the use case and its inputs and
outputs, which is where the book starts every process model.

**What must be obvious at a glance.**

1. Which use case is open, and that it is the form from the book.
2. The steps, and the data that enters and leaves at each one.
3. That the diagrams agree with the form's inputs and outputs.

**Layout.**

| Region | Size | Content |
| --- | --- | --- |
| Top bar | 1440 by 48 | As in section 1.1 |
| Navigator | 216 wide | As in section 1.1 |
| Use case list | 220 wide | The three use cases |
| Page header | 614 by 72 | Above the form |
| Form | 614 wide | The chosen use case. It scrolls |
| Right panel | 390 wide | How the form links to the diagrams |

**Use case list.** Three rows, then the button "New use case". Each row has the ID in
muted text, the name, and under it in muted text the priority and the process.

| ID | Name | Second line |
| --- | --- | --- |
| UC-1 | Schedule Appointment | High · Process 1 |
| UC-2 | Record Visit | High · Process 2 |
| UC-3 | Produce Daily Schedule | Medium · Process 3 |

**Page header.**

- Breadcrumb: "Use cases"
- Title: "UC-1 Schedule Appointment"
- Right end: the buttons "Undo" and "Redo".

**Form.** It is laid out as a ruled form, with each label in a narrow column on the left
and its value on the right.

| Label | Value |
| --- | --- |
| Use case name | Schedule Appointment |
| ID | UC-1 |
| Priority | High |
| Actor | Client |
| Description | A client asks the clinic for an appointment and is given a confirmed time. |
| Trigger | A client asks for an appointment. |
| Type | Two choices side by side, "External" and "Temporal". "External" is chosen |
| Preconditions | 1. The clinic is open for bookings. |

Then a table headed "Normal course", with the button "Add step" under it:

| # | Step | Information for the step |
| --- | --- | --- |
| 1 | The clinic checks which times are free on the preferred date. | In: Visit Details. Out: Available Slot |
| 2 | The clinic books a free time for the client. | In: Client Details, Available Slot. Out: Appointment Record, Booking |
| 3 | The clinic sends the client a confirmation. | In: Booking. Out: Appointment Confirmation |

Then:

| Label | Value |
| --- | --- |
| Postconditions | 1. The appointment is recorded. 2. The client has a confirmation. |
| Exceptions | E1 (step 1): No time is free on the preferred date. The clinic offers the nearest free dates. |

Then two small tables side by side. The first is headed "Summary inputs":

| Data | Source |
| --- | --- |
| Appointment Request | Client |

The second is headed "Summary outputs":

| Data | Destination |
| --- | --- |
| Appointment Confirmation | Client |
| Appointment Record | D1 Appointments |

**Right panel,** from top to bottom.

- Heading: "Links to the diagrams"
- A table. Each row ends in an OK mark:

  | On the form | On the diagrams |
  | --- | --- |
  | This use case | Process 1 Schedule Appointment, on Level 0 |
  | Input: Appointment Request from Client | A flow into process 1 |
  | Output: Appointment Confirmation to Client | A flow out of process 1 |
  | Output: Appointment Record to D1 Appointments | A flow out of process 1 |

- In muted text: "3 steps on the form. 3 processes on the diagram 1 Schedule Appointment."
- Heading: "Problems", with the count "0"
- An OK mark, then: "No problems with this use case."

**The state shown.**

- Selected: the navigator row "Use cases", the list row "UC-1", and step 2 of the normal course, where the cursor is at the end of the step's text.
- Disabled: "Redo".
- Missing: nothing on this screen.
- AI: nothing on this screen.

The form says that "Client Details" enters at step 2. The child diagram has "Booking
Info" there instead, which is the mistake that screen 1 reports. No rule compares a
step with the child diagram, so this screen shows no problem.

## 7. What these briefs add to the specification

The specification settles the model and the rules, not the screens. These points are
choices made here, and each can change.

1. **The small table in a balancing problem card** ("Appointment Request is made of").
   The specification's finding lists the missing part. Showing every part, with where
   each one enters, is a choice made here.
2. **The AI box on screen 1.** No AI feature is built in Release 0. The box shows where
   an AI explanation would sit and how it would be marked. For Release 0 the card ends
   after the table.
3. **"Export PDF" in the top bar.** Export comes in the first release, not Release 0.
4. **The names of seven elements** such as "Confirmation Text". The specification says
   only that each of those structures has one element of its own.
5. **The wording of the use case.** The specification's case gives no use cases.
6. **"1 in · 2 out"** on each item in the outline, and the two-list layout of the
   outline. The specification asks only that the outline be a full keyboard editor.
