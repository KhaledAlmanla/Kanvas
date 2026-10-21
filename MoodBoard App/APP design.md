---
Permission: User only. No AI
---
### Interface:
#### Canvas: 
Can be dark or light, with a dot matrix, and a slight gradient in the color.
Need to implement as switch to switch from dark to light colors.

#### Floating bar:
A floating panel that can be dragged by clicking and holding on a handle on the side.
the floating panel has the following buttons:

| Command / tool           |     |
| ------------------------ | --- |
| Import image<br>         |     |
| ~~Link image~~           |     |
| ~~link a document~~      |     |
| Add a Text box           |     |
| Export board as an image |     |

### Floating bar behavior:
Each board will be completely separate entity. Each will have it's own folder structure, that is un-encrypted and stays on the user's local storage.
When importing images, a copy of the image will be saved into a folder. 
Link images to be implemented later.
Text boxes to be implemented later.
Exporting board to be  implemented later.

### Folder structure:
This Board
- The board main data base; after content is saved to its correct folder, links will be saved here, along with a set of 2D Vector coordinates, that refers to the top left corner of the image/text box. And another 2D vector to describe the size. And for images, a pair of 2D vectors to indicate which parts of the image will be shown, used only when cropping, the 2 2D vectors will function as top left corner and right left corner of each image.
- Images
	- Copy  of images files (png, jpg, tiff.....etc) lives here.
- Text files
	- Each text box will be  saved in a Json or Xml file here.
- Export
	- Png exports of the will be saved here.

### Mouse behavior:
- Left click to select, hold to drag a selection box.
- Left click on an **image** or a **text note** to highlight them, and  have the option bar appearing.
- Left click and hold a **selected image** or a **text note** to  drag it and move it.
- left click hold on the edges of a **selected image** or a **text note** to  drag and change the  aspect ratio.
- Left click with ctrl, to select multiple **images** or a **text notes**.
- Right click will cause the floating bar to jump to the position of the mouse. if the mouse was too close to the edge of the window, it will change its anchor position to the other side.
- Right clicking on an **image** or a **text note**, will cause the option bar to appear.
- Click and hold middle mouse button / mouse wheel to pan around the canvas.
### Images behavior
- Images must be moveable, re-sizeable, deletable. 
- User can move the image by selecting an image and drag it around the canvas.
- User can resize the images by hovering the mouse on the edges, then drag the selected edge.
- User can access the delete and crop commands by right clicking on **selected image**.
### Text note behavior
- Boxes must be moveable, re-sizeable, deletable. 
- User can move the boxes by selecting a note and drag it around the canvas.
- User can resize the note by hovering the mouse on the edges, then drag the selected edge.
- User can access the delete and crop commands by right clicking on **selected note**

### Option bar:
appears when hovering on the image or box, have icons for delete.
Should appear to the side on the image/text box, not inside it.

