# Fahrradtouren-Webanwendung

Dieses Projekt ist eine Webanwendung zur Planung und Verwaltung von Fahrradtouren und Stationen.  
Sie wurde im Rahmen eines universitären Lehrprojekts am Institut für Geoinformatik der Universität Münster entwickelt.

## Features

- **Stationen verwalten:**  
  Neue Stationen können bequem per GeoJSON-Upload, direkt auf der Karte oder per GeoJSON-Texteingabe angelegt werden. Zusätzlich können Stationen auch per Adresssuche über Geokodierung angelegt werden. Jede Station enthält einen Namen, eine Beschreibung und optional eine URL. Wird eine Wikipedia-URL angegeben, ersetzt die Webseite die Beschreibung automatisch mit dem ersten Satz des Artikels. Alle Stationen werden in einer Tabelle dargestellt und können dort editiert oder gelöscht werden. Zudem können Stationen auf der Karte angezeigt und bei Bedarf zusätzlich als GeoJSON-Datei heruntergeladen werden.

- **Touren planen:**  
  Aus den vorhandenen Stationen können individuelle Fahrradtouren zusammengestellt werden. Wähle dafür die gewünschten Stationen in der Übersicht in der passenden Reihenfolge aus. Optional lässt sich eine Rundtour planen, bei der Start- und Endpunkt identisch sind. Für jede Tour wird automatisch eine Route über Fahrradwege oder Straßen berechnet, die mit einem Namen gespeichert werden kann. Die komplette Tour mit Route und Stationen wird anschaulich auf der Karte dargestellt. Für jeden Abschnitt zwischen zwei Stationen wird zusätzlich die Streckenlänge angezeigt. Auch Touren können jederzeit in einer Liste bearbeitet oder gelöscht werden.

- **Export & Übersicht:**  
  Stationen und Touren können als GeoJSON-Datei heruntergeladen werden.  
  Alle Daten werden dauerhaft gespeichert und sind nach einem Neustart wieder verfügbar.

- **Responsives Design:**  
  Die Anwendung ist für PC, Tablet und Smartphone optimiert.

## Installation & Start

1. Repository klonen oder herunterladen.
2. Im Projektordner die Abhängigkeiten installieren:
    ```
    npm install
    ```
3. Die Anwendung starten:
    ```
    npm start
    ```
4. Die Webseite ist erreichbar unter:  
   [http://localhost:3000](http://localhost:3000)

## Verzeichnisstruktur

- `/public` – Enthält alle statischen Dateien wie HTML, CSS, JavaScript und Bilder
- `/db` – Beinhaltet die Konfigurationsdatei für die MongoDB-Anbindung.
- `/routes` – Enthält die serverseitigen Routen für HTTP-GET- und POST-Anfragen an die MongoDB.

## Rechtliches

- Siehe [Impressum](public/impressum.html) und [Datenschutzhinweise](public/datenschutz.html) für weitere Informationen.

---

© 2025 Universität Münster – Institut für