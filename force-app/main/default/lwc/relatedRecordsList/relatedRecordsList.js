import { LightningElement, api, track } from 'lwc';
import getRelatedRecords from '@salesforce/apex/RelatedRecordsController.getRelatedRecords';
import { NavigationMixin } from 'lightning/navigation';

export default class RelatedRecordsList extends NavigationMixin(LightningElement) {
    // 1) Standard recordId (the parent record’s Id)
    @api recordId;

    // 2) Design attributes (set in App Builder)
    @api childObjectApiName;       // e.g. 'Product2'
    @api lookupFieldApiName;       // e.g. 'Company__c'
    @api childRelationshipName;    // e.g. 'Products'
    @api fieldsList;               // comma-separated, e.g. 'Name,ProductCode'
    @api recordLimit = 3;          // how many to show

    @track tableData = [];         // rows for lightning-datatable
    @track columns = [];           // column defs for lightning-datatable
    @track error;                  // actual error message if something goes wrong

    connectedCallback() {
        // 1) Build the table columns from the comma-separated fieldsList
        this.buildColumns();

        // 2) Debug: Log everything we’re about to pass to Apex
        //    (Open your browser’s console to verify these values.)
        console.log(
            'DEBUG → fetchRelatedRecords: parentId=', this.recordId,
            'childObjectApiName=', this.childObjectApiName,
            'lookupFieldApiName=', this.lookupFieldApiName,
            'fieldsList=', this.fieldsList,
            'recordLimit=', this.recordLimit
        );

        // 3) Fetch the data from Apex
        this.fetchRelatedRecords();
    }

    // A user-friendly card title, e.g. “Related Products” or fallback to “Related Records”
    get cardTitle() {
        if (this.childRelationshipName) {
            let rel = this.childRelationshipName.replace(/__r$/, '');
            return `Related ${rel}`;
        }
        return 'Related Records';
    }

    // True if we have at least one record to show
    get hasRecords() {
        return this.tableData && this.tableData.length > 0;
    }

    // True if no rows AND no error
    get noRecordsNoError() {
        return !this.hasRecords && !this.error;
    }

    // Build columns array for lightning-datatable based on fieldsList
    buildColumns() {
        if (!this.fieldsList) {
            this.columns = [];
            return;
        }

        // Split the CSV of field API names, e.g. ["Name", "ProductCode"]
        const fields = this.fieldsList.split(',').map(f => f.trim());
        if (fields.length === 0) {
            this.columns = [];
            return;
        }

        // The first field becomes a clickable link column
        const firstField = fields[0];
        const firstLabel = this.humanizeLabel(firstField);

        const linkColumn = {
            label: firstLabel,
            fieldName: `${firstField}Url`, // we'll inject <firstField>Url below
            type: 'url',
            typeAttributes: {
                label: { fieldName: firstField }, // the clickable text is rec[firstField]
            },
            sortable: false
        };

        // All other fields become plain-text columns
        const otherColumns = fields.slice(1).map(f => ({
            label: this.humanizeLabel(f),
            fieldName: f,
            type: 'text',
            sortable: false
        }));

        // Combine link column + other columns
        this.columns = [linkColumn, ...otherColumns];
    }

    // Call Apex and inject <firstField>Url into each record so the datatable can link to it
    fetchRelatedRecords() {
        // If any required parameter is missing, show a helpful error
        if (
            !this.recordId ||
            !this.childObjectApiName ||
            !this.lookupFieldApiName ||
            !this.fieldsList
        ) {
            this.error = 'Configuration error: one of childObjectApiName, lookupFieldApiName, fieldsList, or recordId is missing.';
            this.tableData = [];
            return;
        }

        getRelatedRecords({
            parentId: this.recordId,
            childObjectApiName: this.childObjectApiName,
            lookupFieldApiName: this.lookupFieldApiName,
            fieldsString: this.fieldsList,
            limitSize: this.recordLimit
        })
        .then(result => {
            // result is an array of SObjects, each containing the requested fields + Id
            const fields = this.fieldsList.split(',').map(f => f.trim());
            const linkField = fields[0]; // e.g. 'Name'

            // Inject a new property "<linkField>Url" for each row: e.g. row['NameUrl'] = '/<Id>'
            this.tableData = result.map(rec => {
                const row = { ...rec };
                row[`${linkField}Url`] = '/' + rec.Id;
                return row;
            });

            // Clear any previous error
            this.error = undefined;
        })
        .catch(err => {
            // Show the raw Apex error (e.g. invalid field, bad SOQL, etc.)
            this.error = err.body && err.body.message ? err.body.message : JSON.stringify(err);
            this.tableData = [];
        });
    }

    // Helper: turn "ProductCode__c" → "Product Code"
    humanizeLabel(apiName) {
        let label = apiName.replace(/__c$|__r$/, '');
        label = label.replace(/_/g, ' ');
        label = label.replace(/([a-z])([A-Z])/g, '$1 $2');
        label = label
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        return label;
    }

    // When View All is clicked, navigate to the standard related list page
    handleViewAll() {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordRelationshipPage',
            attributes: {
                recordId: this.recordId,
                objectApiName: this.childObjectApiName,
                relationshipApiName: this.childRelationshipName,
                actionName: 'view'
            }
        });
    }
}
