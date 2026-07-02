This is a web app I created for my Database Management Systems lecture.

FastAPI
Python
PostegreSQL
Javascript CSS HTML

Core logic behind this app  is victim creates aidrequests, volunteer creates rescources and operators match resources and aidrequests.
Here are the user types I mentioned above.

User Types

Victim
Ability to submit new aid requests (category, urgency, location, description) 
Being able to see status of their requests (pending, assigned, on the way)

Volunteer
Ability to register and update available resources (type, quantity, location, availability) 
Being able to see detailed information about requests (location, urgency, type of need) 
Ability to update task status (on the way, delivered)

Operator
Full visibility of all aid requests and available resources on the map
Real-time status of all assignments 
Ability to match resources with requests 
Access to analytical data (high-demand areas, unmet requests, resource shortages)

Main Objectives

Centralized Coordination: To minimize chaos during disasters by connecting victims and resource providers on a single, real-time platform.
Efficient Matching: To match critical needs (food, medicine, water, shelter) with the most appropriate available resources based on urgency and location.
Data-Driven Decision Making: To provide crisis managers with a comprehensive command panel for monitoring regional disaster status and resource distribution.
